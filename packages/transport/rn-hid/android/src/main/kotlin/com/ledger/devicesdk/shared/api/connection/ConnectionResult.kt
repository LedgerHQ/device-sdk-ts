/*
 * SPDX-FileCopyrightText: 2023 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.api.connection

public sealed class ConnectionResult {
    public data class Connected(
        val device: ConnectedDevice,
    ) : ConnectionResult()

    public data class Disconnected(
        val failure: Failure,
    ) : ConnectionResult()

    // Most of these failures are mapped from the ble library but could be cleaned
    public sealed class Failure {
        public data object PairingFailed : Failure()

        public data object ConnectionTimeout : Failure()

        public data object DeviceNotFound : Failure()

        public data object NoDeviceAddress : Failure()

        public data object ServiceNotFound : Failure()

        public data object InternalState : Failure()

        public data object InitializingFailed : Failure()

        public data object PermissionNotGranted : Failure()

        public data object DeviceConnectivityBluetoothDisabled : Failure()

        public data object DeviceConnectivityLocationDisabled : Failure()

        public data object BleNotSupported : Failure()

        public data class Unknown(
            val msg: String?,
        ) : Failure()
    }
}