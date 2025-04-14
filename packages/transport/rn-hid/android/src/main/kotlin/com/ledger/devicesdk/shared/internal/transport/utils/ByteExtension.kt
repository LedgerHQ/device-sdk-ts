/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.transport.utils

import com.ledger.devicesdk.shared.api.utils.isHexadecimal

internal fun Byte.isNotHexadecimal(): Boolean = !this.isHexadecimal()

@OptIn(ExperimentalStdlibApi::class)
internal fun Byte.isHexadecimal(): Boolean {
    return try {
        this.toHexString().isHexadecimal()
        true
    }
    catch (e: NumberFormatException){
        false
    }
}