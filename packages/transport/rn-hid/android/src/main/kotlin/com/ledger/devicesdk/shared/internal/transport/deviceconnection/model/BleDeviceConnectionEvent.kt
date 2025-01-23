/*
 * SPDX-FileCopyrightText: 2025 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.transport.deviceconnection.model

import com.ledger.devicesdk.shared.internal.transport.ble.model.BleError

internal sealed class BleDeviceConnectionEvent : DeviceConnectionEvent() {
    data class SendAnswer(
        val sendId: String,
        val answer: String,
    ) : BleDeviceConnectionEvent()

    data class Disconnected(
        val reason: BleError? = null,
    ) : BleDeviceConnectionEvent()
}