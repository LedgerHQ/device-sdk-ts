package com.ledger.androidtransporthid.bridge

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.ledger.devicesdk.shared.api.device.LedgerDevice
import com.ledger.devicesdk.shared.api.discovery.ConnectivityType
import com.ledger.devicesdk.shared.api.discovery.DiscoveryDevice

fun LedgerDevice.toWritableMap(): WritableMap {
    val map = Arguments.createMap()
    map.putString("name", this.name)
    map.putString("usbProductIdMask", this.usbInfo.productIdMask)
    return map
}

fun ConnectivityType.toSerializedString(): String {
    return when (this) {
        is ConnectivityType.Usb -> "usb"
    }
}

fun DiscoveryDevice.toWritableMap(): WritableMap {
    val map = Arguments.createMap()
    map.putString("uid", this.uid)
    map.putString("name", this.name)
    map.putMap("ledgerDevice", this.ledgerDevice.toWritableMap())
    map.putString("connectivityType", this.connectivityType.toSerializedString())
    map.putDouble("timestamp", this.timestamp.toDouble())
    return map
}

/* lists */

fun List<DiscoveryDevice>.toWritableArray(): WritableArray {
    val array = Arguments.createArray()
    this.forEach {
        array.pushMap(it.toWritableMap())
    }
    return array
}