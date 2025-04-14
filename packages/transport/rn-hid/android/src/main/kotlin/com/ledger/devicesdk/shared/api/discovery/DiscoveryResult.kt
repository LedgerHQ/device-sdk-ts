/*
 * SPDX-FileCopyrightText: 2023 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.api.discovery

public sealed class DiscoveryResult {
    public data class DeviceDiscovered(
        val devices: List<DiscoveryDevice>,
    ) : DiscoveryResult()

    public data object Ended : DiscoveryResult()

    public sealed class Failure : DiscoveryResult() {
        public data object LocationDisabled : Failure()

        public data object BluetoothDisabled : Failure()

        public data object BluetoothPermissionNotGranted : Failure()

        public data object BluetoothBleNotSupported : Failure()

        public data class Unknown(
            val message: String,
        ) : Failure()
    }
}