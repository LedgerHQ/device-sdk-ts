package com.ledger.devicesdk.shared.api.device

public data class BleInformation(
    val serviceUuid: String,
    val notifyCharacteristicUuid: String,
    val writeWithResponseCharacteristicUuid: String,
    val writeWithoutResponseCharacteristicUuid: String,
)