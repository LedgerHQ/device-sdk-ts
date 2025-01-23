/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.api.device

import com.ledger.devicesdk.shared.api.command.getappandversion.AppAndVersion
import com.ledger.devicesdk.shared.api.command.getosversion.OsVersion
import com.ledger.devicesdk.shared.api.connection.ConnectedDevice

public data class DeviceContext(
    public val device: ConnectedDevice?,
    public val osVersion: OsVersion?,
    public val currentAppAndVersion: AppAndVersion?,
)