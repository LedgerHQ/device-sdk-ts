/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.api.apdu

public data class Apdu internal constructor(
    internal val classInstruction: Byte,
    internal val instructionMethod: Byte,
    internal val parameter1: Byte,
    internal val parameter2: Byte,
    internal val data: ByteArray?,
    internal val dataLength: Int,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || this::class != other::class) return false

        other as Apdu

        if (classInstruction != other.classInstruction) return false
        if (instructionMethod != other.instructionMethod) return false
        if (parameter1 != other.parameter1) return false
        if (parameter2 != other.parameter2) return false
        if (data != null) {
            if (other.data == null) return false
            if (!data.contentEquals(other.data)) return false
        } else if (other.data != null) return false
        if (dataLength != other.dataLength) return false

        return true
    }

    override fun hashCode(): Int {
        var result = classInstruction.toInt()
        result = 31 * result + instructionMethod
        result = 31 * result + parameter1
        result = 31 * result + parameter2
        result = 31 * result + (data?.contentHashCode() ?: 0)
        result = 31 * result + dataLength
        return result
    }
}