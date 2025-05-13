package com.ledger.devicesdk.shared.api.device

public data class UsbInfo(
        val vendorId: String,
        val productIdMask: String,
        val bootloaderProductId: String,
)
