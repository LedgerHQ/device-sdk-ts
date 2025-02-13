/*
 * SPDX-FileCopyrightText: 2023 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.transport.usb.model

internal sealed class UsbPermissionEvent {
    data class PermissionGranted(
        val device: LedgerUsbDevice,
    ) : UsbPermissionEvent()

    data class PermissionDenied(
        val device: LedgerUsbDevice,
    ) : UsbPermissionEvent()
}