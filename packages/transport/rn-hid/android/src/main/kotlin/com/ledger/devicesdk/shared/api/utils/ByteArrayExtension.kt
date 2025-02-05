/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.api.utils

import com.ledger.devicesdk.shared.internal.transport.framer.toInt
import com.ledger.devicesdk.shared.internal.transport.framer.toIntOn2Bytes
import com.ledger.devicesdk.shared.internal.transport.framer.toUInt
import com.ledger.devicesdk.shared.api.utils.isNotHexadecimal
import com.ledger.devicesdk.shared.internal.transport.utils.isNotHexadecimal

public fun ByteArray.isHexadecimal(): Boolean {
    return if (isEmpty()) {
        false
    } else {
        var result = true
        this.forEach {
            if (it.isNotHexadecimal()) {
                result = false
                return@forEach
            }
        }
        result
    }
}

@OptIn(ExperimentalStdlibApi::class)
public fun ByteArray.toHexadecimalString(uppercase: Boolean = true): String {
    var result = ""
    forEach { result += it.toHexString() }
    return if (uppercase) result.uppercase() else result
}

public fun ByteArray.extractField(
    from: Int,
    to: Int,
    fromInclusive: Boolean = true,
    toInclusive: Boolean = true,
): ByteArray =
    when (fromInclusive) {
        true -> {
            when (toInclusive) {
                true -> this.sliceArray(from..to)
                false -> this.sliceArray(from..<to)
            }
        }

        false -> {
            when (toInclusive) {
                true -> this.sliceArray(from + 1..to)
                false -> this.sliceArray(from + 1..<to)
            }
        }
    }

public fun ByteArray.extractFieldAsIntOn2Bytes(
    from: Int,
    to: Int,
    fromInclusive: Boolean = true,
    toInclusive: Boolean = true,
): Int =
    this
        .extractField(
            from = from,
            to = to,
            fromInclusive = fromInclusive,
            toInclusive = toInclusive,
        ).toIntOn2Bytes()

public fun ByteArray.extractFieldAsUInt(
    from: Int,
    to: Int,
    fromInclusive: Boolean = true,
    toInclusive: Boolean = true,
): UInt =
    this
        .extractField(
            from = from,
            to = to,
            fromInclusive = fromInclusive,
            toInclusive = toInclusive,
        ).toUInt()

public fun ByteArray.extractFieldAsInt(
    from: Int,
    to: Int,
    fromInclusive: Boolean = true,
    toInclusive: Boolean = true,
): Int =
    this
        .extractField(
            from = from,
            to = to,
            fromInclusive = fromInclusive,
            toInclusive = toInclusive,
        ).toInt()

public fun ByteArray.decodeString(
    from: Int,
    to: Int,
    fromInclusive: Boolean = true,
    toInclusive: Boolean = true,
): String =
    this
        .extractField(
            from = from,
            to = to,
            fromInclusive = fromInclusive,
            toInclusive = toInclusive,
        ).decodeToString()

public fun ByteArray.extractFieldAtIndexAsInt(at: Int): Int = this[at].toInt()

public fun ByteArray.extractFieldAtIndexAsString(at: Int): String = this[at].toString()