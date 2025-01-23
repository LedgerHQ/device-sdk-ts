/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.api.apdu

public sealed class SendApduResult {
    public data class Success(
        val apdu: ByteArray,
    ) : SendApduResult() {
        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (other == null || this::class != other::class) return false

            other as Success

            return apdu.contentEquals(other.apdu)
        }

        override fun hashCode(): Int {
            return apdu.contentHashCode()
        }
    }

    public data class Failure(
        val reason: SendApduFailureReason,
    ) : SendApduResult()
}

public sealed class SendApduFailureReason {
    public data object DeviceNotFound : SendApduFailureReason()

    public data object NoUsbEndpointFound : SendApduFailureReason()

    public data object ApduNotWellFormatted : SendApduFailureReason()

    public data object DeviceLocked : SendApduFailureReason()

    public data object DeviceBusy : SendApduFailureReason()

    public data object NoResponse : SendApduFailureReason()

    public data object Unknown : SendApduFailureReason()
}