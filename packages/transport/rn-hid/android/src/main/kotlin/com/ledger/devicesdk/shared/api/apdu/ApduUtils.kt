/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.api.apdu

import com.ledger.devicesdk.shared.api.utils.isHexadecimal
import com.ledger.devicesdk.shared.internal.transport.utils.isHexadecimal

internal fun Apdu.toRawApdu(): ByteArray {
    val dataLength = this.dataLength.toByte()
    return byteArrayOf(
        this.classInstruction,
        this.instructionMethod,
        this.parameter1,
        this.parameter2,
    ) + dataLength + (this.data ?: byteArrayOf())
}

public fun Apdu.isNotWellFormatted(): Boolean = !this.isWellFormatted()

public fun Apdu.isWellFormatted(): Boolean = this.isHexadecimalFields()

public fun Apdu.isHexadecimalFields(): Boolean =
    try {
        check(this.classInstruction.isHexadecimal())
        check(this.instructionMethod.isHexadecimal())
        check(this.parameter1.isHexadecimal())
        check(this.parameter2.isHexadecimal())
        if (this.data != null) {
            check(this.data.isHexadecimal())
        }
        true
    } catch (e: IllegalStateException) {
        false
    }