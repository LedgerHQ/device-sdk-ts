/*
 * SPDX-FileCopyrightText: 2023 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.transport.usb

import android.content.Context
import android.hardware.usb.UsbManager
import android.hardware.usb.UsbDevice as AndroidUsbDevice

internal fun interface UsbPermissionRequester {
    fun requestPermission(
        context: Context,
        manager: UsbManager,
        device: AndroidUsbDevice,
    )
}