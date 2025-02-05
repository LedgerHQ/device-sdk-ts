/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.api

public sealed class DeviceAction {
    public data object GetOsVersion : DeviceAction()

    public data object GetAppAndVersion : DeviceAction()

    public data class InstallApplication(
        val appName: String,
    ) : DeviceAction()

    public data object OsUpdate : DeviceAction()

    // fixme will be uncommented once theses device actions be concretely implemented
//    public data object OpenApplication : DeviceAction()
//
//    public data object UpdateApplication : DeviceAction()
}