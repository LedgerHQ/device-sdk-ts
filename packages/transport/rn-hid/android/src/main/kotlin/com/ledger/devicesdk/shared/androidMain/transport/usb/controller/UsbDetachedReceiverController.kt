/*
 * SPDX-FileCopyrightText: 2023 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.transport.usb.controller

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbManager
import androidx.core.content.ContextCompat
import com.ledger.devicesdk.shared.androidMain.transport.usb.AndroidUsbTransport
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.UsbState
import com.ledger.devicesdk.shared.androidMain.transport.usb.utils.getAndroidUsbDevice
import com.ledger.devicesdk.shared.androidMain.transport.usb.utils.toUsbDevice
import com.ledger.devicesdk.shared.internal.utils.Controller
import timber.log.Timber

internal class UsbDetachedReceiverController(
    private val context: Context,
    private val androidUsbTransport: AndroidUsbTransport,
) : BroadcastReceiver(),
    Controller {
    override fun start() {
        Timber.i("start UsbDetachedReceiverController")
        ContextCompat.registerReceiver(
            context,
            this,
            IntentFilter(UsbManager.ACTION_USB_DEVICE_DETACHED),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
    }

    override fun stop() {
        Timber.i("stop UsbDetachedReceiverController")
        context.unregisterReceiver(this)
    }

    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        Timber.i("UsbDetachedReceiverController:onReceive")
        val usbDevice = intent.getAndroidUsbDevice().toUsbDevice()
        if (usbDevice != null) {
            androidUsbTransport.updateUsbState(state = UsbState.Detached(device = usbDevice))
        }
    }
}