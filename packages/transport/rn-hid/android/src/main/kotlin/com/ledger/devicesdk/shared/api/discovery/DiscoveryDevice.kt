/*
 * SPDX-FileCopyrightText: 2023 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.api.discovery

import com.ledger.devicesdk.shared.api.device.LedgerDevice
import kotlinx.datetime.Clock

public data class DiscoveryDevice(
    public val uid: String,
    public val name: String,
    public val ledgerDevice: LedgerDevice,
    public val connectivityType: ConnectivityType,
) {
    public val timestamp: Long = Clock.System.now().toEpochMilliseconds()
}