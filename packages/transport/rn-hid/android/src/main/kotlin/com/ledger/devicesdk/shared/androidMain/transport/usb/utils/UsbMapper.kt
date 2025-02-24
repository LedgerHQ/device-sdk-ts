/*
 * SPDX-FileCopyrightText: 2023 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.transport.usb.utils

import android.content.Intent
import android.hardware.usb.UsbManager
import android.os.Build
import com.ledger.devicesdk.shared.api.device.LedgerDevice
import com.ledger.devicesdk.shared.api.discovery.ConnectivityType
import com.ledger.devicesdk.shared.api.discovery.DiscoveryDevice
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.VendorId
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.ProductId
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.LedgerUsbDevice

internal fun LedgerUsbDevice.toScannedDevice() =
   DiscoveryDevice(
        uid = this.uid,
        name = this.name,
        ledgerDevice = this.ledgerDevice,
        connectivityType = ConnectivityType.Usb,
    )

internal fun List<android.hardware.usb.UsbDevice>.toUsbDevices(): List<LedgerUsbDevice> = mapNotNull { it.toLedgerUsbDevice() }

internal fun android.hardware.usb.UsbDevice.toLedgerUsbDevice(): LedgerUsbDevice? {
    val productId = ProductId(this.productId)
    val vendorId = VendorId(this.vendorId)

    val ledgerDevice = productId.toLedgerDevice()
    return if (vendorId.id == LedgerDevice.LEDGER_USB_VENDOR_ID.toProductIdInt() && ledgerDevice != null) {
        return LedgerUsbDevice(
            uid = this.deviceId.toString(),
            name = ledgerDevice.name,
            vendorId = vendorId,
            productId = productId,
            ledgerDevice = ledgerDevice,
        )
    } else {
        null
    }
}

private fun String.toProductIdInt(): Int = this.substring(2).toInt(16)

internal fun Intent.getAndroidUsbDevice(): android.hardware.usb.UsbDevice {
    val device =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getParcelableExtra(UsbManager.EXTRA_DEVICE, android.hardware.usb.UsbDevice::class.java)
        } else {
            getParcelableExtra(UsbManager.EXTRA_DEVICE)
        }
    return checkNotNull(device)
}