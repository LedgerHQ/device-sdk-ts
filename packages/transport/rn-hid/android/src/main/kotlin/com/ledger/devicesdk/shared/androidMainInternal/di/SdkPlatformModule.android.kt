/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMainInternal.di

import android.content.Context
import com.ledger.devicesdk.shared.androidMain.di.androidSdkPlatformModule
import com.ledger.devicesdk.shared.androidMain.transport.usb.di.USB_CONTROLLERS
import com.ledger.devicesdk.shared.internal.di.resolveControllers
import org.koin.android.ext.koin.androidContext
import org.koin.core.KoinApplication
import org.koin.dsl.module

private val qualifierControllers =
    buildList {
        add(USB_CONTROLLERS)
    }

internal fun sdkPlatformModule(koinApplication: KoinApplication, context: Any?) = module {
    koinApplication.androidContext(context as Context)
    includes(androidSdkPlatformModule)
}

internal fun startSdkPlatformModule(koinApplication: KoinApplication) {
    with(koinApplication) {
        resolveControllers(qualifierNames = qualifierControllers).forEach { it.start() }
    }
}

internal fun destroySdkPlatformModule(koinApplication: KoinApplication) {
    with(koinApplication) {
        resolveControllers(qualifierNames = qualifierControllers).forEach { it.stop() }
    }
}