/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.transport.usb

import android.app.Application
import android.hardware.usb.UsbManager
import android.hardware.usb.UsbRequest
import com.ledger.devicesdk.shared.api.discovery.DiscoveryDevice
import com.ledger.devicesdk.shared.internal.connection.InternalConnectedDevice
import com.ledger.devicesdk.shared.internal.connection.InternalConnectionResult
import com.ledger.devicesdk.shared.internal.event.SdkEventDispatcher
import com.ledger.devicesdk.shared.internal.service.logger.LoggerService
import com.ledger.devicesdk.shared.internal.service.logger.buildSimpleInfoLogInfo
import com.ledger.devicesdk.shared.internal.transport.TransportEvent
import com.ledger.devicesdk.shared.internal.transport.framer.FramerService
import com.ledger.devicesdk.shared.androidMain.transport.usb.connection.AndroidUsbDeviceConnection
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.UsbDevice
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.UsbPermissionEvent
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.UsbState
import com.ledger.devicesdk.shared.androidMain.transport.usb.utils.toScannedDevice
import com.ledger.devicesdk.shared.androidMain.transport.usb.utils.toUsbDevices
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
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

internal class DefaultAndroidUsbTransport(
    private val application: Application,
    private val usbManager: UsbManager,
    private val permissionRequester: UsbPermissionRequester,
    private val eventDispatcher: SdkEventDispatcher,
    private val loggerService: LoggerService,
    private val scanDelay: Duration,
    coroutineDispatcher: CoroutineDispatcher,
) : AndroidUsbTransport {
    private val scope = CoroutineScope(coroutineDispatcher + SupervisorJob())
    private val internalUsbEventFlow: MutableSharedFlow<UsbState> = MutableSharedFlow()
    private val internalUsbPermissionEventFlow: MutableSharedFlow<UsbPermissionEvent> = MutableSharedFlow()

    @Suppress("BackingPropertyName")
    private var _scanStateFlow: MutableStateFlow<List<DiscoveryDevice>> = MutableStateFlow(emptyList())
    private var discoveryJob: Job? = null
    private val usbConnections: MutableMap<String, AndroidUsbDeviceConnection> = mutableMapOf()

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
                                usbConnections.filter { device == it.value.usbDevice }.isEmpty()
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
                val id = generateSessionId(state.device.uid) // TODO: backport this fix to DMK Mobile
                if (usbConnections.containsKey(id)) {
                    usbConnections.remove(id)
                    eventDispatcher.dispatch(TransportEvent.DeviceConnectionLost(id))
                }
            }
        }
    }

    override fun updateUsbEvent(event: UsbPermissionEvent) {
        scope.launch {
            internalUsbPermissionEventFlow.emit(event)
        }
    }

    override suspend fun connect(discoveryDevice: DiscoveryDevice): InternalConnectionResult {
        val device: android.hardware.usb.UsbDevice? =
            usbManager.deviceList.values.firstOrNull { it.deviceId == discoveryDevice.uid.toInt() }

        return if (device == null) {
            InternalConnectionResult.ConnectionError(error = InternalConnectionResult.Failure.DeviceNotFound)
        } else {
            val establishConnectionFn = {
                val sessionId = generateSessionId(id = device.deviceId.toString())
                val newConnection =
                    AndroidUsbDeviceConnection(
                        usbManager = usbManager,
                        usbDevice = device,
                        ioDispatcher = Dispatchers.IO,
                        framerService = FramerService(loggerService),
                        request = UsbRequest(),
                    )
                val connectedDevice =
                    InternalConnectedDevice(
                        sessionId,
                        discoveryDevice.name,
                        discoveryDevice.ledgerDevice,
                        discoveryDevice.connectivityType,
                        sendApduFn = { apdu -> newConnection.send(apdu) },
                    )
                usbConnections[sessionId] = newConnection
                InternalConnectionResult.Connected(device = connectedDevice, sessionId = sessionId)
            }

            if (usbManager.hasPermission(device)) {
                return establishConnectionFn()
            }

            val result = merge(
                internalUsbPermissionEventFlow,
                internalUsbEventFlow,
            ).onStart {
                permissionRequester.requestPermission(
                    context = application,
                    manager = usbManager,
                    device = device,
                )
            }.first {
                it is UsbPermissionEvent.PermissionGranted ||
                    it is UsbPermissionEvent.PermissionDenied ||
                    it is UsbState.Detached
            }

            when (result) {
                is UsbPermissionEvent -> {
                    when (result) {
                        is UsbPermissionEvent.PermissionDenied -> {
                            InternalConnectionResult.ConnectionError(
                                error = InternalConnectionResult.Failure.PermissionNotGranted,
                            )
                        }

                        is UsbPermissionEvent.PermissionGranted -> {
                            establishConnectionFn()
                        }
                    }
                }

                else -> {
                    InternalConnectionResult.ConnectionError(error = InternalConnectionResult.Failure.DeviceNotFound)
                }
            }
        }
    }

    override suspend fun disconnect(deviceId: String) {
        usbConnections[deviceId]?.let {
            usbConnections.remove(deviceId)
            eventDispatcher.dispatch(TransportEvent.DeviceConnectionLost(deviceId))
        }
    }

    private fun generateSessionId(id: String): String = "usb_$id"
}

private fun List<UsbDevice>.toScannedDevices(): List<DiscoveryDevice> =
    this.map {
        it.toScannedDevice()
    }