/*
 * SPDX-FileCopyrightText: 2025 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.androidMainInternal.transport.deviceconnection

import com.ledger.devicesdk.shared.api.apdu.SendApduResult

internal interface DeviceApduSender<Dependencies> {
    suspend fun send(apdu: ByteArray): SendApduResult
    fun setDependencies(dependencies: Dependencies)
    fun getDependencies(): Dependencies
    suspend fun setupConnection()
    suspend fun closeConnection()
}