/*
 * SPDX-FileCopyrightText: 2023 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.api.connection

import com.ledger.devicesdk.shared.api.device.LedgerDevice
import com.ledger.devicesdk.shared.api.discovery.ConnectivityType
import com.ledger.devicesdk.shared.internal.connection.InternalConnectedDevice

public data class ConnectedDevice(
    public val uid: String,
    public val name: String,
    public val ledgerDevice: LedgerDevice,
    public val connectivityType: ConnectivityType,
)

internal fun InternalConnectedDevice.toConnectedDevice(): ConnectedDevice =
    ConnectedDevice(
        uid = this.id,
        name = this.name,
        ledgerDevice = this.ledgerDevice,
        connectivityType = this.connectivity,
    )