package com.ledger.devicesdk.shared.internal.connection

internal sealed class InternalConnectionResult {
    data class Connected(
        val device: InternalConnectedDevice,
        val sessionId: String,
    ) : InternalConnectionResult()

    data class ConnectionError(
        val error: Failure,
    ) : InternalConnectionResult()

    // Most of these failures are mapped from the ble library but could be cleaned
    sealed class Failure {
        data object PairingFailed : Failure()

        data object ConnectionTimeout : Failure()

        data object DeviceNotFound : Failure()

        data object NoDeviceAddress : Failure()

        data object ServiceNotFound : Failure()

        data object InternalState : Failure()

        data object InitializingFailed : Failure()

        data object PermissionNotGranted : Failure()

        data object DeviceConnectivityBluetoothDisabled : Failure()

        data object DeviceConnectivityLocationDisabled : Failure()

        data object BleNotSupported : Failure()

        data class Unknown(
            val msg: String?,
        ) : Failure()
    }
}