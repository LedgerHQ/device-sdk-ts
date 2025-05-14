/*
 * SPDX-FileCopyrightText: 2025 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMainInternal.transport.deviceconnection

import com.ledger.devicesdk.shared.api.apdu.SendApduResult
import kotlin.time.Duration

internal interface DeviceApduSender<Dependencies> {
    suspend fun send(apdu: ByteArray, abortTimeoutDuration: Duration): SendApduResult
    val dependencies: Dependencies
}
