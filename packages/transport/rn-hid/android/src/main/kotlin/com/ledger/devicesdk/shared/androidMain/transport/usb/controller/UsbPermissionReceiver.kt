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
import com.ledger.devicesdk.shared.androidMain.transport.usb.utils.toLedgerUsbDevice
import com.ledger.devicesdk.shared.internal.service.logger.LoggerService
import com.ledger.devicesdk.shared.internal.service.logger.buildSimpleDebugLogInfo
import com.ledger.devicesdk.shared.internal.utils.Controller
import timber.log.Timber

internal const val ACTION_USB_PERMISSION = "com.android.example.USB_PERMISSION"

internal class UsbPermissionReceiver(
    private val context: Context,
    private val androidUsbTransport: AndroidUsbTransport,
    private val loggerService: LoggerService,
) : BroadcastReceiver(),
    Controller {
    override fun start() {
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
        context.unregisterReceiver(this)
    }

    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        Timber.i("UsbPermissionReceiver:onReceive")
        if (ACTION_USB_PERMISSION == intent.action) {
            synchronized(this) {
                val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
                val androidUsbDevice = usbManager.deviceList.values.firstOrNull {
                    usbManager.hasPermission(it) && it.toLedgerUsbDevice() != null
                }
                val ledgerUsbDevice = androidUsbDevice?.toLedgerUsbDevice()
                if (ledgerUsbDevice != null) {
                    loggerService.log(
                        buildSimpleDebugLogInfo(
                            "UsbPermissionReceiver:onReceive",
                            "permission granted"
                        )
                    )
                    androidUsbTransport.updateUsbEvent(
                        UsbPermissionEvent.PermissionGranted(ledgerUsbDevice = ledgerUsbDevice)
                    )
                } else {
                    loggerService.log(
                        buildSimpleDebugLogInfo(
                            "UsbPermissionReceiver:onReceive",
                            "permission denied"
                        )
                    )
                    androidUsbTransport.updateUsbEvent(
                        UsbPermissionEvent.PermissionDenied
                    )
                }

            }
        }
    }
}