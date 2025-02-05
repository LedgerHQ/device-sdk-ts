/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.api.apdu

import com.ledger.devicesdk.shared.api.utils.extractField

public class ApduParser(
    private val response: ByteArray,
) {
    private var currentIndex = 0

    public fun extractByteValue(): Byte = extract1BytesValue().first()

    public fun extract1BytesValue(): ByteArray = extractBytesValue(nbrBytes = 1)

    public fun extract2BytesValue(): ByteArray = extractBytesValue(nbrBytes = 2)

    public fun extract3BytesValue(): ByteArray = extractBytesValue(nbrBytes = 3)

    public fun extract4BytesValue(): ByteArray = extractBytesValue(nbrBytes = 4)

    public fun extractValueString(nbrBytes: Int): String = extractBytesValue(nbrBytes = nbrBytes).decodeToString()

    public fun extractRemainingBytesValue(): ByteArray = extractBytesValue(nbrBytes = response.size - currentIndex)

    public fun extractBytesValue(nbrBytes: Int): ByteArray {
        val index = currentIndex + nbrBytes
        val result = response.extractField(from = currentIndex, to = index, toInclusive = false)
        currentIndex += nbrBytes
        return result
    }

    public fun getCurrentIndex(): Int = currentIndex
}