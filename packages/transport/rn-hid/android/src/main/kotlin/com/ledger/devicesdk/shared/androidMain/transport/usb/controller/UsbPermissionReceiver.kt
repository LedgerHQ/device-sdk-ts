/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.transport.usb.controller

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.ledger.devicesdk.shared.androidMain.transport.usb.AndroidUsbTransport
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.UsbPermissionEvent
import com.ledger.devicesdk.shared.androidMain.transport.usb.utils.getAndroidUsbDevice
import com.ledger.devicesdk.shared.androidMain.transport.usb.utils.toUsbDevice
import com.ledger.devicesdk.shared.internal.utils.Controller
import timber.log.Timber

internal const val ACTION_USB_PERMISSION = "com.android.example.USB_PERMISSION"

internal class UsbPermissionReceiver(
    private val context: Context,
    private val androidUsbTransport: AndroidUsbTransport,
) : BroadcastReceiver(),
    Controller {
    override fun start() {
        Timber.i("UsbPermissionReceiver started")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.registerReceiver(
                context,
                this,
                IntentFilter(ACTION_USB_PERMISSION),
                ContextCompat.RECEIVER_NOT_EXPORTED,
            )
        } else {
            ContextCompat.registerReceiver(
                context,
                this,
                IntentFilter(ACTION_USB_PERMISSION),
                ACTION_USB_PERMISSION,
                null,
                ContextCompat.RECEIVER_NOT_EXPORTED,
            )
        }
    }

    override fun stop() {
        Timber.i("UsbPermissionReceiver stopped")
        context.unregisterReceiver(this)
    }

    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        Timber.i("UsbPermissionReceiver:onReceive")
        if (ACTION_USB_PERMISSION == intent.action) {
            synchronized(this) {
                val androidUsbDevice = intent.getAndroidUsbDevice()
                val device = androidUsbDevice.toUsbDevice()
                if (device != null) {
                    if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                        Timber.d("permission granted")
                        androidUsbTransport.updateUsbEvent(UsbPermissionEvent.PermissionGranted(device = device))
                    } else {
                        Timber.d("permission denied")
                        androidUsbTransport.updateUsbEvent(UsbPermissionEvent.PermissionDenied(device = device))
                    }
                }
            }
        }
    }
}