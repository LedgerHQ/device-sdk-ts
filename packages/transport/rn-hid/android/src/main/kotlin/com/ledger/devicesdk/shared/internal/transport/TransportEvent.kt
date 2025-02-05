/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.transport

internal sealed class TransportEvent {
    data class DeviceConnectionLost(
        val id: String,
    ) : TransportEvent()
}

internal sealed class BluetoothTransportEvent : TransportEvent() {
    data object BluetoothDisable : BluetoothTransportEvent()

    data object BluetoothEnable : BluetoothTransportEvent()
}