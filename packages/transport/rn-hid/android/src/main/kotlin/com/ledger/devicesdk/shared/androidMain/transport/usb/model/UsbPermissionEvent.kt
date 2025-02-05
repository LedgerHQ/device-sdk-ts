/*
 * SPDX-FileCopyrightText: 2023 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.transport.usb.model

internal sealed class UsbPermissionEvent {
    data class PermissionGranted(
        val device: UsbDevice,
    ) : UsbPermissionEvent()

    data class PermissionDenied(
        val device: UsbDevice,
    ) : UsbPermissionEvent()
}