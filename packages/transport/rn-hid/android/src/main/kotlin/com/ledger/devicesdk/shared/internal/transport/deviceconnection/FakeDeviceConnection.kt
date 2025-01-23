/*
 * SPDX-FileCopyrightText: 2023 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.transport.deviceconnection

import com.ledger.devicesdk.shared.androidMainInternal.transport.deviceconnection.DeviceConnection
import com.ledger.devicesdk.shared.api.apdu.SendApduFailureReason
import com.ledger.devicesdk.shared.api.apdu.SendApduResult
import com.ledger.devicesdk.shared.internal.service.stub.StubApduProvider
import kotlin.random.Random
import kotlin.time.Duration.Companion.seconds
import kotlinx.coroutines.delay

internal class FakeDeviceConnection : DeviceConnection {
    private var deviceLocked = false
    private val apduProvider = StubApduProvider()

    override suspend fun send(apdu: ByteArray): SendApduResult {
        delay(1.seconds)
        return if (Random.nextBoolean() || deviceLocked) {
            val response: ByteArray =
                apduProvider.apdu.entries
                    .firstOrNull {
                        it.key contentEquals apdu
                    }?.value ?: (Random.nextBytes(60) + byteArrayOf(9.toByte(), 0.toByte(), 0.toByte(), 0.toByte()))
            SendApduResult.Success(
                apdu = response,
            )
        } else {
            deviceLocked = true
            SendApduResult.Failure(reason = SendApduFailureReason.DeviceLocked)
        }
    }
}