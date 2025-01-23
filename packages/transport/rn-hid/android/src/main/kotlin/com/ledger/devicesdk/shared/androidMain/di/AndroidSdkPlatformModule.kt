/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.di

import com.ledger.devicesdk.shared.androidMain.transport.usb.di.usbModule
import org.koin.dsl.module

internal val androidSdkPlatformModule = module {
    includes(usbModule)
}