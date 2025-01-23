/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.transport.usb

import com.ledger.devicesdk.shared.androidMain.transport.usb.AndroidUsbTransport
import com.ledger.devicesdk.shared.api.device.LedgerDevice
import com.ledger.devicesdk.shared.api.discovery.ConnectivityType
import com.ledger.devicesdk.shared.api.discovery.DiscoveryDevice
import com.ledger.devicesdk.shared.internal.connection.InternalConnectedDevice
import com.ledger.devicesdk.shared.internal.connection.InternalConnectionResult
import com.ledger.devicesdk.shared.internal.transport.deviceconnection.FakeDeviceConnection
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.UsbPermissionEvent
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.UsbState
import kotlin.time.Duration.Companion.seconds
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

internal class FakeAndroidUsbTransport : AndroidUsbTransport {
    private var errorTriggered = false
    private var deviceLocked = false

    val scannedDevice =
        listOf(
            DiscoveryDevice(
                uid = "USB 0",
                name = LedgerDevice.Stax.toString(),
                ledgerDevice = LedgerDevice.Stax,
                connectivityType = ConnectivityType.Usb,
            ),
            DiscoveryDevice(
                uid = "USB 1",
                name = LedgerDevice.NanoX.toString(),
                ledgerDevice = LedgerDevice.NanoX,
                connectivityType = ConnectivityType.Usb,
            ),
        )

    override fun startScan(): StateFlow<List<DiscoveryDevice>> = MutableStateFlow(scannedDevice)

    override fun stopScan() {}

    override fun updateUsbState(state: UsbState) {}

    override fun updateUsbEvent(event: UsbPermissionEvent) {}

    override suspend fun connect(discoveryDevice: DiscoveryDevice): InternalConnectionResult {
        delay(1.seconds)
        return InternalConnectionResult.Connected(
                device = InternalConnectedDevice(
                    "sessionId",
                    discoveryDevice.name,
                    discoveryDevice.ledgerDevice,
                    discoveryDevice.connectivityType,
                    sendApduFn = { apdu -> FakeDeviceConnection().send(apdu = apdu) },
            ),
            sessionId = "sessionId"
        )
        /* val result =
             if (Random.nextBoolean() || errorTriggered) {
                 val usbDevice = devices.first { it.uid == uid }
                 connectedDevice = usbDevice.toConnectedDevice()
                 _usbStateFlow.emit(UsbState.Connected(usbDevice))
                 ConnectionResult.Connected(connectedDevice!!)
             } else {
                 errorTriggered = true
                 _usbStateFlow.emit(UsbState.Disconnected(deviceUid = null))
                 ConnectionResult.Disconnected(failure = ConnectionResult.Failure.DeviceNotFound)
             }
         _usbStateFlow.emit(UsbState.Attached(devices = devices))
         */
        return InternalConnectionResult.ConnectionError(
            error = InternalConnectionResult.Failure.Unknown("NEED IMPLEMENT IN FAKE !"),
        )
    }

    override suspend fun disconnect(deviceId: String) {
        /*connectedDevice = null
        errorTriggered = false
        deviceLocked = false
        _usbStateFlow.emit(UsbState.Disconnected(device.uid))
        delay(1.seconds)
        _usbStateFlow.emit(UsbState.Attached(devices = devices))*/
    }
}