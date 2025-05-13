/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.api.utils

@Throws(IllegalStateException::class)
public fun String.fromHexStringToBytesOrThrow(): ByteArray {
    check(this.isHexadecimal()) { "$this is not in hexadecimal format" }
    return chunked(2)
        .map(String::fromHexStringToByteOrThrow)
        .toByteArray()
}

@Throws(NumberFormatException::class)
public fun String.fromHexStringToByteOrThrow(): Byte = this.toInt(16).toByte()

public fun String.isHexadecimal(): Boolean = this.isNotEmpty() && this.matches(Regex("^[A-Fa-f0-9]+$"))

public fun String.isNotHexadecimal(): Boolean = !this.isHexadecimal()