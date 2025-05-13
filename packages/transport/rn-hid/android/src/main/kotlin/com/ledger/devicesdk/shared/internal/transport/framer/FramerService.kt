/*
 * SPDX-FileCopyrightText: 2025 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.transport.framer

import com.ledger.devicesdk.shared.api.apdu.ApduParser
import com.ledger.devicesdk.shared.api.utils.toHexadecimalString
import com.ledger.devicesdk.shared.internal.service.logger.LoggerService
import com.ledger.devicesdk.shared.internal.service.logger.buildSimpleInfoLogInfo
import com.ledger.devicesdk.shared.internal.transport.framer.model.ApduFrame
import com.ledger.devicesdk.shared.internal.transport.framer.model.ApduFramerHeader
import com.ledger.devicesdk.shared.internal.transport.framer.model.HEADER_SIZE
import com.ledger.devicesdk.shared.internal.transport.framer.model.MAXIMUM_HEADER_SIZE
import com.ledger.devicesdk.shared.internal.transport.utils.extractApduSize
import com.ledger.devicesdk.shared.internal.transport.utils.extractFrameHeader

private const val TAG = "FramerService"

internal class FramerService(
    private val loggerService: LoggerService
) {
    fun serialize(
        mtu: Int,
        channelId: ByteArray?,
        rawApdu: ByteArray,
    ): List<ApduFrame> {
        val header = ApduFramerHeader(channelId = channelId, frameId = byteArrayOf(0x00, 0x00))
        val apduSize = rawApdu.size.to2BytesArray()
        val frames =
            if (rawApdu.isShortApdu(mtu = mtu)) {
                val paddingSize = mtu - header.size() - apduSize.size - rawApdu.size
                val finalApdu = rawApdu + ByteArray(paddingSize)
                listOf(
                    ApduFrame(
                        header = header,
                        apduSize = apduSize,
                        apdu = finalApdu,
                    ),
                )
            } else {
                var isBuildingFrames = true
                var counter = 0
                var startIndex = 0
                var endIndex = mtu - header.size() - apduSize.size
                buildList {
                    while (isBuildingFrames) {
                        if (counter == 0) {
//                            loggerService.log(
//                                info = buildSimpleInfoLogInfo(
//                                    tag = TAG,
//                                    message = "-- IF -- startIndex = $startIndex / endIndex = $endIndex",
//                                ),
//                            )
                            add(
                                ApduFrame(
                                    header = header,
                                    apduSize = apduSize,
                                    apdu = rawApdu.slice(startIndex..<endIndex).toByteArray(),
                                ),
                            )
                        } else {
                            startIndex = endIndex
                            endIndex = (mtu - header.size()) + startIndex
//                            loggerService.log(
//                                info = buildSimpleInfoLogInfo(
//                                    tag = TAG,
//                                    message = "-- ELSE -- startIndex = $startIndex / endIndex = $endIndex",
//                                ),
//                            )
                            if (endIndex <= rawApdu.size) {
                                add(
                                    ApduFrame(
                                        ApduFramerHeader(
                                            channelId = channelId,
                                            frameId = counter.to2BytesArray(),
                                        ),
                                        apduSize = null,
                                        apdu = rawApdu.slice(startIndex..<endIndex).toByteArray(),
                                    ),
                                )
                            } else {
                                val apduExtracted = rawApdu.slice(startIndex..<rawApdu.size).toByteArray()
                                val paddingSize = mtu - header.size() - apduExtracted.size
                                val finalApdu =
                                    apduExtracted + ByteArray(paddingSize)
                                add(
                                    ApduFrame(
                                        header =
                                        ApduFramerHeader(
                                            channelId = channelId,
                                            frameId = counter.to2BytesArray(),
                                        ),
                                        apduSize = null,
                                        apdu = finalApdu,
                                    ),
                                )
                                isBuildingFrames = false
                            }
                        }
                        counter += 1
                    }
                }
            }
//        loggerService.log(
//            info = buildSimpleInfoLogInfo(
//                tag = TAG,
//                message = "APDU SERIALIZATION RESULT : \n${frames.toHexadecimalString()}",
//            ),
//        )
        return frames
    }

    fun deserialize(
        mtu: Int,
        frames: List<ApduFrame>,
    ): ByteArray {
//        loggerService.log(
//            info = buildSimpleInfoLogInfo(
//                tag = TAG,
//                message = "APDU DESERIALIZATION RESULT : \n",
//            ),
//        )
        var payload = byteArrayOf()
        return if (frames.isEmpty()) {
            payload
        } else {
            var rawApdu: ByteArray
            var offset = mtu - MAXIMUM_HEADER_SIZE
            var apduSize = frames.first().apduSize!!.toIntOn2Bytes()
//            loggerService.log(
//                info = buildSimpleInfoLogInfo(
//                    tag = TAG,
//                    message =
//                    "Header: ${frames.first().header}\n" +
//                        "ApduSize : $apduSize",
//                ),
//            )
            for (apduFrame in frames) {
                if (offset < apduSize) {
                    rawApdu = apduFrame.apdu.extractApdu(toExclusive = offset)
                    payload += rawApdu
                    apduSize -= offset
                    offset = mtu - HEADER_SIZE
                } else {
                    rawApdu = apduFrame.apdu.extractApdu(toExclusive = apduSize)
                    payload += rawApdu
                    break
                }
//                loggerService.log(
//                    info = buildSimpleInfoLogInfo(
//                        tag = TAG,
//                        message = "Apdu : ${rawApdu.toHexadecimalString()}",
//                    ),
//                )
            }
            return payload
        }
    }

    fun createApduFrames(
        mtu: Int,
        isUsbTransport: Boolean,
        onCreateBuffer: ()->ByteArray,
    ): List<ApduFrame> {
        var firstFrame = true
        var nbrDataRead = 0
        var apduSizeInt = 0
        return buildList {
            do {
                val rawApdu: ByteArray
                val apduSize: ByteArray?
                val buffer = onCreateBuffer()
                if(buffer.isEmpty()){
                    return emptyList()
                }
                val parser = ApduParser(response = buffer)
                val header = buffer.extractFrameHeader(isUsbTransport = isUsbTransport, parser = parser)
                if (firstFrame) {
                    apduSize = buffer.extractApduSize(parser = parser)
                    apduSizeInt = apduSize.toIntOn2Bytes()
                    rawApdu = parser.extractRemainingBytesValue()
                    firstFrame = false
                } else {
                    apduSize = null
                    rawApdu = parser.extractRemainingBytesValue()
                }
                nbrDataRead += rawApdu.size
                add(
                    ApduFrame(
                        header = header,
                        apduSize = apduSize,
                        apdu = rawApdu,
                    ),
                )
//                loggerService.log(
//                    buildSimpleInfoLogInfo(
//                        tag = TAG,
//                        message = "APDU received = ${rawApdu.toHexadecimalString()}",
//                    ),
//                )
            } while (nbrDataRead < apduSizeInt)
        }
    }

    private fun ByteArray.isShortApdu(mtu: Int): Boolean = this.size < mtu - MAXIMUM_HEADER_SIZE

    private fun ByteArray.extractApdu(toExclusive: Int) = this.sliceArray(0..<toExclusive)
}