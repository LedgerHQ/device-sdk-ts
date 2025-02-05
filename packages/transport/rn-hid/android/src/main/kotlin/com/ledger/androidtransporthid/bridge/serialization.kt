package com.ledger.androidtransporthid.bridge

import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.ledger.devicesdk.shared.api.apdu.SendApduFailureReason
import com.ledger.devicesdk.shared.api.apdu.SendApduResult
import com.ledger.devicesdk.shared.api.device.LedgerDevice
import com.ledger.devicesdk.shared.api.discovery.ConnectivityType
import com.ledger.devicesdk.shared.api.discovery.DiscoveryDevice
import com.ledger.devicesdk.shared.internal.connection.InternalConnectionResult
import com.ledger.devicesdk.shared.internal.service.logger.LogInfo
import com.ledger.devicesdk.shared.internal.service.logger.LogLevel
import com.ledger.devicesdk.shared.internal.transport.TransportEvent
import kotlinx.datetime.Clock

fun LedgerDevice.toWritableMap(): WritableMap {
    val map = Arguments.createMap()
    map.putString("name", this.name)
    map.putString("usbProductIdMask", this.usbInfo.productIdMask)
    return map
}

fun DiscoveryDevice.toWritableMap(): WritableMap {
    val map = Arguments.createMap()
    map.putString("uid", this.uid)
    map.putString("name", this.name)
    map.putMap("ledgerDevice", this.ledgerDevice.toWritableMap())
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
    map.putString("tag", "[TransportHidModule][${this.tag}]")
    map.putString("message", this.message)
    map.putMap("jsonPayLoad", Arguments.makeNativeMap(this.jsonPayLoad))
    map.putString("timestamp", Clock.System.now().toEpochMilliseconds().toString())
    return map
}

internal fun InternalConnectionResult.toWritableMap(): WritableMap {
    when (this) {
        is InternalConnectionResult.Connected -> {
            val map = Arguments.createMap()
            map.putBoolean("success", true)
            map.putString("sessionId", this.sessionId)
            map.putMap("ledgerDevice", this.device.ledgerDevice.toWritableMap())
            map.putString("deviceName", this.device.name)
            return map
        }
        is InternalConnectionResult.ConnectionError -> {
            val map = Arguments.createMap()
            map.putBoolean("success", false)
            map.putString("error", when (this.error) {
                /**
                 * Most of these errors are for the BLE lib so it does not really make sense
                 * to have them here but for the sake of being explicit and not using an "else"
                 * where a new error type could be added, we list everything.
                 */
                InternalConnectionResult.Failure.BleNotSupported -> "BleNotSupported"
                InternalConnectionResult.Failure.ConnectionTimeout -> "ConnectionTimeout"
                InternalConnectionResult.Failure.DeviceConnectivityBluetoothDisabled -> "DeviceConnectivityBluetoothDisabled"
                InternalConnectionResult.Failure.DeviceConnectivityLocationDisabled -> "DeviceConnectivityLocationDisabled"
                InternalConnectionResult.Failure.DeviceNotFound -> "DeviceNotFound"
                InternalConnectionResult.Failure.InitializingFailed -> "InitializingFailed"
                InternalConnectionResult.Failure.InternalState -> "InternalState"
                InternalConnectionResult.Failure.NoDeviceAddress -> "NoDeviceAddress"
                InternalConnectionResult.Failure.PairingFailed -> "PairingFailed"
                InternalConnectionResult.Failure.PermissionNotGranted -> "PermissionNotGranted"
                InternalConnectionResult.Failure.ServiceNotFound -> "ServiceNotFound"
                is InternalConnectionResult.Failure.Unknown -> "UnknownError: ${this.error.msg}"
            })
            return map
        }
    }
}

internal fun SendApduResult.toWritableMap(): WritableMap {
    when(this) {
        is SendApduResult.Success -> {
            val map = Arguments.createMap()
            map.putBoolean("success", true)
            map.putString("apdu", Base64.encodeToString(this.apdu, Base64.DEFAULT))
            return map
        }
        is SendApduResult.Failure -> {
            val map = Arguments.createMap()
            map.putBoolean("success", false)
            map.putString("error", when (this.reason) {
                SendApduFailureReason.ApduNotWellFormatted -> "ApduNotWellFormatted"
                SendApduFailureReason.DeviceBusy -> "DeviceBusy"
                SendApduFailureReason.DeviceLocked -> "DeviceLocked"
                SendApduFailureReason.DeviceNotFound -> "DeviceNotFound"
                SendApduFailureReason.NoResponse -> "NoResponse"
                SendApduFailureReason.NoUsbEndpointFound -> "NoUsbEndpointFound"
                SendApduFailureReason.Unknown -> "Unknown"
            })
            return map
        }
    }
}

internal fun TransportEvent.DeviceConnectionLost.toWritableMap(): WritableMap {
    val map = Arguments.createMap()
    map.putString("id", this.id)
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