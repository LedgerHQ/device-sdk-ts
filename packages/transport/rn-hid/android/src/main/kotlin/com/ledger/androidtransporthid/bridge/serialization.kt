package com.ledger.androidtransporthid.bridge

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.ledger.devicesdk.shared.api.device.LedgerDevice
import com.ledger.devicesdk.shared.api.discovery.ConnectivityType
import com.ledger.devicesdk.shared.api.discovery.DiscoveryDevice
import com.ledger.devicesdk.shared.internal.service.logger.LogInfo
import com.ledger.devicesdk.shared.internal.service.logger.LogLevel
import kotlinx.datetime.Clock

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

internal fun LogLevel.toSerializedString(): String {
    return when (this) {
        LogLevel.DEBUG -> "debug"
        LogLevel.INFO -> "info"
        LogLevel.WARNING -> "warning"
        LogLevel.ERROR -> "error"
    }
}

internal fun LogInfo.toWritableMap(): WritableMap {
    val map = Arguments.createMap()
    map.putString("level", this.level.toSerializedString())
    map.putString("tag", this.tag)
    map.putString("message", this.message)
    map.putMap("jsonPayLoad", Arguments.makeNativeMap(this.jsonPayLoad))
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