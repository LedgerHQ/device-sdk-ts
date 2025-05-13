/*
 * SPDX-FileCopyrightText: 2023 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.transport.usb

import com.ledger.devicesdk.shared.internal.transport.Transport
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.UsbPermissionEvent
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.UsbState

internal interface AndroidUsbTransport: Transport {
    fun updateUsbState(state: UsbState)

    fun updateUsbEvent(event: UsbPermissionEvent)
}