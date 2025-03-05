/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.transport.usb

import android.app.Application
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.hardware.usb.UsbRequest
import com.ledger.devicesdk.shared.api.discovery.DiscoveryDevice
import com.ledger.devicesdk.shared.internal.connection.InternalConnectedDevice
import com.ledger.devicesdk.shared.internal.connection.InternalConnectionResult
import com.ledger.devicesdk.shared.internal.event.SdkEventDispatcher
import com.ledger.devicesdk.shared.internal.service.logger.LoggerService
import com.ledger.devicesdk.shared.internal.transport.TransportEvent
import com.ledger.devicesdk.shared.internal.transport.framer.FramerService
import com.ledger.devicesdk.shared.androidMain.transport.usb.connection.AndroidUsbApduSender
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.LedgerUsbDevice
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.UsbPermissionEvent
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.UsbState
import com.ledger.devicesdk.shared.androidMain.transport.usb.utils.toLedgerUsbDevice
import com.ledger.devicesdk.shared.androidMain.transport.usb.utils.toScannedDevice
import com.ledger.devicesdk.shared.androidMain.transport.usb.utils.toUsbDevices
import com.ledger.devicesdk.shared.androidMainInternal.transport.deviceconnection.DeviceConnection
import com.ledger.devicesdk.shared.internal.service.logger.buildSimpleDebugLogInfo
import com.ledger.devicesdk.shared.internal.service.logger.buildSimpleErrorLogInfo
import com.ledger.devicesdk.shared.internal.service.logger.buildSimpleInfoLogInfo
import com.ledger.devicesdk.shared.internal.service.logger.buildSimpleWarningLogInfo
import kotlin.time.Duration
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.shareIn
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.log
import kotlin.time.Duration.Companion.seconds

internal class DefaultAndroidUsbTransport(
    private val application: Application,
    private val usbManager: UsbManager,
    private val permissionRequester: UsbPermissionRequester,
    private val eventDispatcher: SdkEventDispatcher,
    private val loggerService: LoggerService,
    private val scanDelay: Duration,
    private val coroutineDispatcher: CoroutineDispatcher,
) : AndroidUsbTransport {
    private val scope = CoroutineScope(coroutineDispatcher + SupervisorJob())
    private val internalUsbEventFlow: MutableSharedFlow<UsbState> = MutableSharedFlow()
    private val internalUsbPermissionEventFlow: MutableSharedFlow<UsbPermissionEvent> =
        MutableSharedFlow()

    @Suppress("BackingPropertyName")
    private var _scanStateFlow: MutableStateFlow<List<DiscoveryDevice>> =
        MutableStateFlow(emptyList())
    private var discoveryJob: Job? = null
    private val usbConnections: MutableMap<String, DeviceConnection<AndroidUsbApduSender.Dependencies>> =
        mutableMapOf()
    private val usbConnectionsPendingReconnection: MutableSet<DeviceConnection<AndroidUsbApduSender.Dependencies>> =
        mutableSetOf()

    override fun startScan(): Flow<List<DiscoveryDevice>> {
        discoveryJob?.cancel()
        _scanStateFlow.value = emptyList()
        discoveryJob =
            scope.launch {
                while (isActive) {
                    val usbDevices = usbManager.deviceList.values.toList()
                    val devices =
                        usbDevices
                            .filter { device ->
                                usbConnections.filter {
                                    device == it.value.getApduSender().dependencies.usbDevice
                                }.isEmpty()
                            }.toUsbDevices()

                    _scanStateFlow.value = devices.toScannedDevices()

                    delay(scanDelay)
                }
            }
        return _scanStateFlow
    }

    override fun stopScan() {
        discoveryJob?.cancel()
        discoveryJob = null
    }

    override fun updateUsbState(state: UsbState) {
        when (state) {
            is UsbState.Detached -> {
                loggerService.log(buildSimpleDebugLogInfo("AndroidUsbTransport", "Detached deviceId=${state.ledgerUsbDevice.uid}"))
                usbConnections.entries.find {
                    it.value.getApduSender().dependencies.ledgerUsbDevice.uid == state.ledgerUsbDevice.uid
                }.let { item ->
                    scope.launch {
                        if (item == null) {
                            loggerService.log(buildSimpleWarningLogInfo("AndroidUsbTransport", "No connection found"))
                            return@launch
                        }
                        val (key, deviceConnection) = item
                        loggerService.log(buildSimpleInfoLogInfo("AndroidUsbTransport", "Device disconnected (sessionId=${deviceConnection.sessionId})"))
                        deviceConnection.handleDeviceDisconnected()
                        usbConnections.remove(key)
                        usbConnectionsPendingReconnection.add(deviceConnection)
                    }
                }
            }

            is UsbState.Attached -> {
                loggerService.log(buildSimpleDebugLogInfo("AndroidUsbTransport", "Attached deviceId=${state.ledgerUsbDevice.uid}, pendingReconnections=${usbConnectionsPendingReconnection}"))
                val usbDevice = usbManager.deviceList.values.firstOrNull {
                    it.toLedgerUsbDevice()?.uid == state.ledgerUsbDevice.uid
                }
                if (usbDevice == null) {
                    loggerService.log(buildSimpleWarningLogInfo("AndroidUsbTransport", "No UsbDevice found"))
                    return
                }
                usbConnectionsPendingReconnection.firstOrNull {
                    it.getApduSender()
                        .dependencies.ledgerUsbDevice.ledgerDevice == state.ledgerUsbDevice.ledgerDevice // we just find a similar device model since there is no way to uniquely identify a device between 2 connections
                }.let { deviceConnection ->
                    scope.launch {
                        if (deviceConnection == null) {
                            loggerService.log(
                                buildSimpleWarningLogInfo(
                                    "AndroidUsbTransport",
                                    "No pending connection found"
                                )
                            )
                            return@launch
                        }
                        loggerService.log(buildSimpleDebugLogInfo("AndroidUsbTransport", "Found matching device connection $deviceConnection"))

                        val permissionResult = checkOrRequestPermission(usbDevice)
                        if (permissionResult is PermissionResult.Denied) {
                            loggerService.log(buildSimpleDebugLogInfo("AndroidUsbTransport", "Permission denied"))
                            return@launch
                        }
                        loggerService.log(buildSimpleInfoLogInfo("AndroidUsbTransport", "Reconnecting device (sessionId=${deviceConnection.sessionId})"))
                        deviceConnection.handleDeviceConnected(
                            AndroidUsbApduSender(
                                dependencies = AndroidUsbApduSender.Dependencies(
                                    usbDevice = usbDevice,
                                    ledgerUsbDevice = state.ledgerUsbDevice,
                                ),
                                usbManager = usbManager,
                                ioDispatcher = Dispatchers.IO,
                                framerService = FramerService(loggerService),
                                request = UsbRequest(),
                                loggerService = loggerService
                            )
                        )
                        usbConnectionsPendingReconnection.remove(deviceConnection)
                        usbConnections[deviceConnection.sessionId] = deviceConnection
                    }
                }
            }
        }
    }

    override fun updateUsbEvent(event: UsbPermissionEvent) {
        scope.launch {
            internalUsbPermissionEventFlow.emit(event)
        }
    }

    sealed class PermissionResult {
        data object Granted : PermissionResult()
        data class Denied(val connectionError: InternalConnectionResult.ConnectionError) :
            PermissionResult()
    }

    private suspend fun checkOrRequestPermission(usbDevice: UsbDevice): PermissionResult {
        if (usbManager.hasPermission(usbDevice)) {
            return PermissionResult.Granted
        }

        val eventsFlow = merge(
            internalUsbPermissionEventFlow,
            internalUsbEventFlow,
        ).shareIn(scope = scope, started = SharingStarted.Eagerly)

        permissionRequester.requestPermission(
            context = application,
            manager = usbManager,
            device = usbDevice,
        )

        loggerService.log(buildSimpleDebugLogInfo("AndroidUsbTransport", "Waiting for permission result"))

        val result = eventsFlow.first {
            it is UsbPermissionEvent.PermissionGranted ||
                    it is UsbPermissionEvent.PermissionDenied ||
                    it is UsbState.Detached
        }

        loggerService.log(buildSimpleDebugLogInfo("AndroidUsbTransport", "Got permission result"))

        return when (result) {
            is UsbPermissionEvent -> {
                return when (result) {
                    is UsbPermissionEvent.PermissionDenied -> {
                        PermissionResult.Denied(
                            InternalConnectionResult.ConnectionError(
                                error = InternalConnectionResult.Failure.PermissionNotGranted,
                            )
                        )
                    }

                    is UsbPermissionEvent.PermissionGranted -> {
                        PermissionResult.Granted
                    }
                }
            }

            else -> {
                PermissionResult.Denied(InternalConnectionResult.ConnectionError(error = InternalConnectionResult.Failure.DeviceNotFound))
            }
        }
    }

    override suspend fun connect(discoveryDevice: DiscoveryDevice): InternalConnectionResult {
        val usbDevice: UsbDevice? =
            usbManager.deviceList.values.firstOrNull { it.deviceId == discoveryDevice.uid.toInt() }

        val ledgerUsbDevice = usbDevice?.toLedgerUsbDevice()

        return if (usbDevice == null || ledgerUsbDevice == null) {
            InternalConnectionResult.ConnectionError(error = InternalConnectionResult.Failure.DeviceNotFound)
        } else {
            val permissionResult = checkOrRequestPermission(usbDevice)
            if (permissionResult is PermissionResult.Denied) {
                return permissionResult.connectionError
            }

            val sessionId = generateSessionId(usbDevice)
            val apduSender =
                AndroidUsbApduSender(
                    dependencies = AndroidUsbApduSender.Dependencies(
                        usbDevice = usbDevice,
                        ledgerUsbDevice = ledgerUsbDevice,
                    ),
                    usbManager = usbManager,
                    ioDispatcher = Dispatchers.IO,
                    framerService = FramerService(loggerService),
                    request = UsbRequest(),
                    loggerService = loggerService,
                )

            val deviceConnection = DeviceConnection(
                sessionId = sessionId,
                deviceApduSender = apduSender,
                isFatalSendApduFailure = { false }, // TODO: refine this
                reconnectionTimeoutDuration = 5.seconds,
                onTerminated = {
                    usbConnections.remove(sessionId)
                    usbConnectionsPendingReconnection.remove(it)
                    eventDispatcher.dispatch(TransportEvent.DeviceConnectionLost(sessionId))
                },
                coroutineDispatcher = coroutineDispatcher,
                loggerService = loggerService,
            )

            val connectedDevice =
                InternalConnectedDevice(
                    sessionId,
                    discoveryDevice.name,
                    discoveryDevice.ledgerDevice,
                    discoveryDevice.connectivityType,
                    sendApduFn = { apdu -> deviceConnection.requestSendApdu(apdu) },
                )

            usbConnections[sessionId] = deviceConnection

            InternalConnectionResult.Connected(device = connectedDevice, sessionId = sessionId)
        }
    }

    override suspend fun disconnect(deviceId: String) {
        usbConnections[deviceId]?.requestCloseConnection()
    }

    private fun generateSessionId(usbDevice: UsbDevice): String = "usb_${usbDevice.deviceId}"
}

private fun List<LedgerUsbDevice>.toScannedDevices(): List<DiscoveryDevice> =
    this.map {
        it.toScannedDevice()
    }