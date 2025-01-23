/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.transport.framer.model

@OptIn(ExperimentalStdlibApi::class)
internal data class ApduFramerHeader(
    val channelId: ByteArray?,
    val tagId: Byte = 0x05.toByte(),
    val frameId: ByteArray,
) {
    init {
        if(channelId != null){
            require(channelId.size == CHANNEL_ID_SIZE)
        }
        require(frameId.size == FRAME_ID_SIZE)
    }

    fun toByteArray(): ByteArray {
        return if(channelId != null){
            channelId +
                tagId +
                frameId
        }
        else{
            byteArrayOf(tagId) + frameId
        }
    }

    override fun toString(): String {
        var result = "--HEADER FRAME--\nchannelId = "
        channelId?.map {
            result += "${it.toHexString().uppercase()} "
        }
        result += "\ntagId = ${tagId.toHexString().uppercase()}"
        result += "\nframeId = "
        frameId.map {
            result += "${it.toHexString().uppercase()} "
        }
        return result
    }

    fun size(): Int {
        val size = frameId.size + 1 // 1 byte relating to the tagId
        return if(channelId != null){
            size + channelId.size
        }
        else{
            size
        }
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || this::class != other::class) return false

        other as ApduFramerHeader

        if (!channelId.contentEquals(other.channelId)) return false
        if (tagId != other.tagId) return false
        if (!frameId.contentEquals(other.frameId)) return false

        return true
    }

    override fun hashCode(): Int {
        var result = channelId.contentHashCode()
        result = 31 * result + tagId
        result = 31 * result + frameId.contentHashCode()
        return result
    }
}