/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.transport.usb.di

import com.ledger.devicesdk.shared.androidMain.transport.usb.controller.UsbAttachedReceiverController
import com.ledger.devicesdk.shared.androidMain.transport.usb.controller.UsbDetachedReceiverController
import com.ledger.devicesdk.shared.androidMain.transport.usb.controller.UsbPermissionReceiver
import org.koin.core.qualifier.named
import org.koin.dsl.module

internal const val USB_CONTROLLERS = "USB_CONTROLLERS"

internal val usbControllerModule = module {
    single(qualifier = named(USB_CONTROLLERS), createdAtStart = true) {
        listOf(
            UsbAttachedReceiverController(
                context = get(),
                androidUsbTransport = get(),
            ),
            UsbDetachedReceiverController(
                context = get(),
                androidUsbTransport = get(),
            ),
            UsbPermissionReceiver(
                context = get(),
                androidUsbTransport = get(),
            ),
        )
    }
}