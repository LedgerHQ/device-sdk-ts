package com.ledger.devicesdk.shared.internal.connection

import com.ledger.devicesdk.shared.api.apdu.SendApduResult
import com.ledger.devicesdk.shared.api.device.LedgerDevice
import com.ledger.devicesdk.shared.api.discovery.ConnectivityType

internal data class InternalConnectedDevice(
    val id: String,
    val name: String,
    val ledgerDevice: LedgerDevice,
    val connectivity: ConnectivityType,
    val sendApduFn: suspend (apdu: ByteArray, triggersDisconnection: Boolean, abortTimeoutDuration: kotlin.time.Duration) -> SendApduResult,
)