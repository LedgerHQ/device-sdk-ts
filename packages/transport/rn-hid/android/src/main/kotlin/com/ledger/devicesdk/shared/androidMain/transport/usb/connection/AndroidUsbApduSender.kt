/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMain.transport.usb.connection

import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.hardware.usb.UsbRequest
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.LedgerUsbDevice
import com.ledger.devicesdk.shared.androidMainInternal.transport.USB_MTU
import com.ledger.devicesdk.shared.androidMainInternal.transport.deviceconnection.DeviceApduSender
import com.ledger.devicesdk.shared.api.apdu.SendApduFailureReason
import com.ledger.devicesdk.shared.api.apdu.SendApduResult
import com.ledger.devicesdk.shared.api.utils.toHexadecimalString
import com.ledger.devicesdk.shared.internal.service.logger.LoggerService
import com.ledger.devicesdk.shared.internal.service.logger.buildSimpleDebugLogInfo
import com.ledger.devicesdk.shared.internal.service.logger.buildSimpleErrorLogInfo
import com.ledger.devicesdk.shared.internal.transport.framer.FramerService
import com.ledger.devicesdk.shared.internal.transport.framer.to2BytesArray
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.nio.ByteBuffer
import kotlin.random.Random
import kotlin.time.Duration

private const val USB_TIMEOUT = 500

private const val DEFAULT_USB_INTERFACE = 0

internal class AndroidUsbApduSender(
    override val dependencies: Dependencies,
    usbManager: UsbManager,
    private val framerService: FramerService,
    private val request: UsbRequest,
    private val ioDispatcher: CoroutineDispatcher,
    private val loggerService: LoggerService,
) : DeviceApduSender<AndroidUsbApduSender.Dependencies> {
    data class Dependencies(
        val usbDevice: UsbDevice,
        val ledgerUsbDevice: LedgerUsbDevice,
    )

    private val usbDevice = dependencies.usbDevice
    private val usbInterface = usbDevice.getInterface(DEFAULT_USB_INTERFACE)
    private val androidToUsbEndpoint =
        usbInterface.firstEndpointOrThrow { it == UsbConstants.USB_DIR_OUT }
    private val usbToAndroidEndpoint =
        usbInterface.firstEndpointOrThrow { it == UsbConstants.USB_DIR_IN }
    private val usbConnection = usbManager.openDevice(usbDevice)
        .apply { claimInterface(usbInterface, true) }


    fun release() {
        usbConnection.releaseInterface(usbInterface)
        usbConnection.close()
    }

    override suspend fun send(apdu: ByteArray, abortTimeoutDuration: Duration): SendApduResult =
        try {
            withContext(context = ioDispatcher) {

                val timeoutJob = launch {
                    delay(abortTimeoutDuration)
                    throw SendApduTimeoutException
                }

                transmitApdu(
                    usbConnection = usbConnection,
                    androidToUsbEndpoint = androidToUsbEndpoint,
                    rawApdu = apdu,
                )

                loggerService.log(
                    buildSimpleDebugLogInfo(
                        "AndroidUsbApduSender",
                        "[exchange] => ${apdu.toHexadecimalString(uppercase = false)}"
                    )
                )

                val apduResponse =
                    receiveApdu(
                        usbConnection = usbConnection,
                        usbToAndroidEndpoint = usbToAndroidEndpoint,
                    )

                loggerService.log(
                    buildSimpleDebugLogInfo(
                        "AndroidUsbApduSender",
                        "[exchange] <= ${apduResponse.toHexadecimalString(uppercase = false)}"
                    )
                )

                timeoutJob.cancel()

                if (apduResponse.isEmpty()) {
                    return@withContext SendApduResult.Failure(reason = SendApduFailureReason.EmptyResponse)
                }

                return@withContext SendApduResult.Success(apdu = apduResponse)
            }
        } catch (e: SendApduTimeoutException) {
            loggerService.log(
                buildSimpleErrorLogInfo(
                    "AndroidUsbApduSender",
                    "timeout in send: $e"
                )
            )
            SendApduResult.Failure(reason = SendApduFailureReason.AbortTimeout)
        } catch (e: NoSuchElementException) {
            loggerService.log(
                buildSimpleErrorLogInfo(
                    "AndroidUsbApduSender",
                    "no endpoint found: $e"
                )
            )
            SendApduResult.Failure(reason = SendApduFailureReason.NoUsbEndpointFound)
        } catch (e: Exception) {
            loggerService.log(buildSimpleErrorLogInfo("AndroidUsbApduSender", "error in send: $e"))
            SendApduResult.Failure(reason = SendApduFailureReason.Unknown)
        }

    private fun transmitApdu(
        usbConnection: UsbDeviceConnection,
        androidToUsbEndpoint: UsbEndpoint,
        rawApdu: ByteArray,
    ) {
        framerService.serialize(mtu = USB_MTU, channelId = generateChannelId(), rawApdu = rawApdu)
            .forEach { apduFrame ->
                val buffer = apduFrame.toByteArray()
                usbConnection.bulkTransfer(
                    androidToUsbEndpoint,
                    buffer,
                    apduFrame.size(),
                    USB_TIMEOUT
                )
            }
    }

    private fun receiveApdu(
        usbConnection: UsbDeviceConnection,
        usbToAndroidEndpoint: UsbEndpoint,
    ): ByteArray {
        return if (!request.initialize(usbConnection, usbToAndroidEndpoint)) {
            request.close()
            byteArrayOf()
        } else {
            val frames = framerService.createApduFrames(mtu = USB_MTU, isUsbTransport = true) {
                val buffer = ByteArray(USB_MTU)
                val responseBuffer = ByteBuffer.allocate(USB_MTU)

                val queuingResult = request.queue(responseBuffer)
                if (!queuingResult) {
                    request.close()
                    byteArrayOf()
                } else {
                    usbConnection.requestWait()
                    responseBuffer.rewind()
                    responseBuffer.get(buffer, 0, responseBuffer.remaining())
                    buffer
                }
            }
            framerService.deserialize(mtu = USB_MTU, frames)
        }
    }

    private fun UsbInterface.firstEndpointOrThrow(predicate: (Int) -> Boolean): UsbEndpoint {
        for (endp in 0..this.endpointCount) {
            val endpoint = this.getEndpoint(endp)
            val endpointDirection = endpoint.direction
            if (predicate(endpointDirection)) {
                return endpoint
            }
        }
        throw NoSuchElementException("No endpoint matching the predicate")
    }

    private fun generateChannelId(): ByteArray =
        Random.nextInt(0, until = Int.MAX_VALUE).to2BytesArray()

    private data object SendApduTimeoutException : Exception() {
        private fun readResolve(): Any = SendApduTimeoutException
    }
}