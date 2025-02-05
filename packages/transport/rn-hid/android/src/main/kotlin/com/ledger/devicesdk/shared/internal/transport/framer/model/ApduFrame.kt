/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.transport.framer.model

@OptIn(ExperimentalStdlibApi::class) // Use of Byte.toHexString()
internal data class ApduFrame(
    val header: ApduFramerHeader,
    val apduSize: ByteArray?,
    val apdu: ByteArray,
) {
    init {
        apduSize?.let { require(it.size == APDU_SIZE_SIZE) }
    }

    fun toByteArray(): ByteArray =
        header.toByteArray() +
            (apduSize?.let { byteArrayOf(apduSize[0], apduSize[1]) } ?: byteArrayOf()) +
            apdu

    fun size(): Int {
        val apduSize = apduSize?.size ?: 0
        return header.size() +
            apduSize +
            apdu.size
    }

    override fun toString(): String {
        var result = "$header\napduSize = "
        apduSize?.map {
            result += "${it.toHexString().uppercase()} "
        }
        result += "\napdu = "
        apdu.map {
            result += "${it.toHexString().uppercase()} "
        }
        return result
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || this::class != other::class) return false

        other as ApduFrame

        if (header != other.header) return false
        if (apduSize != null) {
            if (other.apduSize == null) return false
            if (!apduSize.contentEquals(other.apduSize)) return false
        } else if (other.apduSize != null) {
            return false
        }
        if (!apdu.contentEquals(other.apdu)) return false

        return true
    }

    override fun hashCode(): Int {
        var result = header.hashCode()
        result = 31 * result + (apduSize?.contentHashCode() ?: 0)
        result = 31 * result + apdu.contentHashCode()
        return result
    }
}