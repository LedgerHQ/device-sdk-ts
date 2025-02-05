/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.transport

import com.ledger.devicesdk.shared.api.discovery.DiscoveryDevice
import com.ledger.devicesdk.shared.internal.connection.InternalConnectionResult
import kotlinx.coroutines.flow.Flow

internal interface Transport {
    fun startScan(): Flow<List<DiscoveryDevice>>

    fun stopScan()

    // TODO change by Flow<ConnectedDeviceState> or add observe device connection for listening device state flow through?
    suspend fun connect(discoveryDevice: DiscoveryDevice): InternalConnectionResult

    suspend fun disconnect(deviceId: String)
}