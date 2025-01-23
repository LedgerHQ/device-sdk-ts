/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.api.device

import com.ledger.devicesdk.shared.api.command.getappandversion.AppAndVersion
import com.ledger.devicesdk.shared.api.command.getosversion.OsVersion
import com.ledger.devicesdk.shared.api.discovery.ConnectivityType

public data class ConnectedDeviceInformation(
    val uid: String,
    val name: String,
    val ledgerDevice: LedgerDevice,
    val connectivityType: ConnectivityType,
    val status: DeviceStatus,
    val osVersion: OsVersion? = null,
    val currentApp: AppAndVersion? = null,
    val appList: List<AppAndVersion> = emptyList(),
)

public enum class DeviceStatus {
    CONNECTED,
    READY,
    LOCKED,
    BUSY,
    DISCONNECTED,
}