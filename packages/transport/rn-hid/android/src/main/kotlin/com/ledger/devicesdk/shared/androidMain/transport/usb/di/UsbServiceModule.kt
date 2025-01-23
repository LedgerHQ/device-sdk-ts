/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.transport.usb.di

import android.app.PendingIntent
import android.content.Intent
import com.ledger.devicesdk.shared.internal.di.ENABLE_FAKE
import com.ledger.devicesdk.shared.internal.transport.Transport
import com.ledger.devicesdk.shared.internal.utils.DISPATCHERS_IO
import com.ledger.devicesdk.shared.androidMain.transport.usb.DefaultAndroidUsbTransport
import com.ledger.devicesdk.shared.androidMain.transport.usb.FakeAndroidUsbTransport
import com.ledger.devicesdk.shared.androidMain.transport.usb.AndroidUsbTransport
import com.ledger.devicesdk.shared.androidMain.transport.usb.controller.ACTION_USB_PERMISSION
import kotlin.random.Random
import kotlin.time.Duration.Companion.milliseconds
import org.koin.core.qualifier.named
import org.koin.dsl.binds
import org.koin.dsl.module

internal val usbServiceModule = module {
    single {
        val enableFake = get<Boolean>(named(ENABLE_FAKE))
        if (enableFake) {
            FakeAndroidUsbTransport()
        } else {
            DefaultAndroidUsbTransport(
                application = get(),
                usbManager = get(),
                permissionRequester = { context, manager, device ->
                    manager.requestPermission(
                        device,
                        PendingIntent.getBroadcast(
                            context,
                            Random.nextInt(),
                            Intent(ACTION_USB_PERMISSION),
                            PendingIntent.FLAG_MUTABLE,
                        ),
                    )
                },
                eventDispatcher = get(),
                coroutineDispatcher = get(named(DISPATCHERS_IO)),
                loggerService = get(),
                scanDelay = 500.milliseconds,
            )
        }
    } binds arrayOf(AndroidUsbTransport::class, Transport::class)
}