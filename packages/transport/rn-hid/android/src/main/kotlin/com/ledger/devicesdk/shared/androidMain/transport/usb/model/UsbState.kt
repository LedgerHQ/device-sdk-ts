/*
 * SPDX-FileCopyrightText: 2023 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.transport.usb.model

internal sealed class UsbState {
    data class Detached(
        val ledgerUsbDevice: LedgerUsbDevice,
        val usbDevice: android.hardware.usb.UsbDevice,
    ) : UsbState()

    data class Attached(
        val ledgerUsbDevice: LedgerUsbDevice,
        val usbDevice: android.hardware.usb.UsbDevice,
    ): UsbState()
}