/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.service.stub

import com.ledger.devicesdk.shared.api.utils.fromHexStringToBytesOrThrow

internal class StubApduProvider {
    val apdu: Map<ByteArray, ByteArray>
        get() =
            mapOf(
                // GetOsVersion
                "E001000000".fromHexStringToBytesOrThrow() to
                    "3320000405312e312e3004e600000004352e313904302e3434010001009000".fromHexStringToBytesOrThrow(),
                // GetAppAndVersion
                "B001000000".fromHexStringToBytesOrThrow() to
                    "0105424f4c4f5305312e312e309000".fromHexStringToBytesOrThrow(),
            )
}