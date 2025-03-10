/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.transport.framer

import com.ditchoom.buffer.ByteOrder
import com.ditchoom.buffer.PlatformBuffer
import com.ditchoom.buffer.allocate
import com.ditchoom.buffer.wrap
import com.ledger.devicesdk.shared.internal.transport.framer.model.ApduFrame

internal fun Int.to2BytesArray(): ByteArray {
    val result = PlatformBuffer.allocate(Int.SIZE_BYTES).apply { writeShort(this@to2BytesArray.toShort()) }

    return byteArrayOf(result[0], result[1])
}

internal fun List<ApduFrame>.toHexadecimalString(): String {
    var result = ""
    forEach { result += it.toString() }
    return result
}

internal fun ByteArray.toIntOn2Bytes(): Int =
    PlatformBuffer.wrap(this).readShort().toInt()

internal fun ByteArray.toUInt(bo: ByteOrder = ByteOrder.LITTLE_ENDIAN) = this.toInt(bo = bo).toUInt()

internal fun ByteArray.toInt(bo: ByteOrder = ByteOrder.LITTLE_ENDIAN): Int {
    val paddedByteArray = ByteArray(Int.SIZE_BYTES)
    this.copyInto(paddedByteArray)
    return PlatformBuffer.wrap(array = paddedByteArray, byteOrder = bo).readInt()
}