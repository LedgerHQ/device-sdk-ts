/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.transport.usb.utils

import com.ledger.devicesdk.shared.api.device.LedgerDevice
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.ProductId

internal fun ProductId.toLedgerDevice(): LedgerDevice? =
    when {
        this.id.isLedgerDeviceProductId(LedgerDevice.NanoS)
        -> {
            LedgerDevice.NanoS
        }

        this.id.isLedgerDeviceProductId(LedgerDevice.NanoSPlus)
        -> {
            LedgerDevice.NanoSPlus
        }

        this.id.isLedgerDeviceProductId(LedgerDevice.NanoX)
        -> {
            LedgerDevice.NanoX
        }

        this.id.isLedgerDeviceProductId(LedgerDevice.Stax)
        -> {
            LedgerDevice.Stax
        }

        this.id.isLedgerDeviceProductId(LedgerDevice.Flex)
        -> {
            LedgerDevice.Flex
        }

        else -> {
            null
        }
    }

private fun Int.isLedgerDeviceProductId(device: LedgerDevice): Boolean {
    val productId = device.usbInfo.productIdMask.sdkHexToInt()
    val bootloaderProductId = productId shr 4
    return ((this shr 8) == productId) || ((this) == bootloaderProductId)
}

@OptIn(ExperimentalStdlibApi::class)
public fun String.sdkHexToInt(withPrefix: Boolean = true): Int =
    if (withPrefix) {
        this.substring(2).hexToInt()
    } else {
        this.hexToInt()
    }