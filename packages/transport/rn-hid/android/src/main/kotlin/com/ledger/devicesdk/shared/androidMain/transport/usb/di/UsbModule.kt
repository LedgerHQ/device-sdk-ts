/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.transport.usb.di

import android.content.Context
import android.hardware.usb.UsbManager
import org.koin.dsl.module

internal val usbModule = module {
    single { get<Context>().getSystemService(Context.USB_SERVICE) as UsbManager }
    includes(usbServiceModule, usbControllerModule)
}