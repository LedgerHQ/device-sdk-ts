/*
 * SPDX-FileCopyrightText: 2023 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.transport.usb.model

import com.ledger.devicesdk.shared.api.device.LedgerDevice

internal class LedgerUsbDevice(
    val uid: String,
    val name: String,
    val vendorId: VendorId,
    val productId: ProductId,
    val ledgerDevice: LedgerDevice,
)