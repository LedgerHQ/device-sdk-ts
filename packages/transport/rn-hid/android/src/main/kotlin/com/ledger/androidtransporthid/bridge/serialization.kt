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

fun LedgerDevice.toWritableMap(): WritableMap =
    Arguments.createMap().apply {
        putString("name", name)
        putString("usbProductIdMask", usbInfo.productIdMask)
    }

fun DiscoveryDevice.toWritableMap(): WritableMap =
    Arguments.createMap().apply {
        putString("uid", uid)
        putString("name", name)
        putMap("ledgerDevice", ledgerDevice.toWritableMap())
    }


internal fun LogLevel.toSerializedString(): String =
    when (this) {
        LogLevel.DEBUG -> "debug"
        LogLevel.INFO -> "info"
        LogLevel.WARNING -> "warning"
        LogLevel.ERROR -> "error"
    }


internal fun LogInfo.toWritableMap(): WritableMap =
    Arguments.createMap().apply {
        putString("level", level.toSerializedString())
        putString("tag", "[TransportHidModule][${tag}]")
        putString("message", message)
        putMap("jsonPayLoad", Arguments.makeNativeMap(jsonPayLoad))
        putString("timestamp", Clock.System.now().toEpochMilliseconds().toString())
    }

internal fun InternalConnectionResult.toWritableMap(): WritableMap =
    when (this) {
        is InternalConnectionResult.Connected -> {
            Arguments.createMap().apply {
                putBoolean("success", true)
                putString("sessionId", sessionId)
                putMap("ledgerDevice", device.ledgerDevice.toWritableMap())
                putString("deviceName", device.name)
            }
        }
        is InternalConnectionResult.ConnectionError -> {
            Arguments.createMap().apply {
                putString("error", when (error) {
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
                    is InternalConnectionResult.Failure.Unknown -> "UnknownError: ${error.msg}"
                })
                putBoolean("success", false)
            }
        }
    }

internal fun SendApduResult.toWritableMap(): WritableMap {
    when(this) {
        is SendApduResult.Success -> {
            return Arguments.createMap().apply {
                putBoolean("success", true)
                putString("apdu", Base64.encodeToString(apdu, Base64.DEFAULT))
            }
        }
        is SendApduResult.Failure -> {
            return Arguments.createMap().apply {
                putBoolean("success", false)
                putString("error", when (reason) {
                    SendApduFailureReason.ApduNotWellFormatted -> "ApduNotWellFormatted"
                    SendApduFailureReason.DeviceBusy -> "DeviceBusy"
                    SendApduFailureReason.DeviceLocked -> "DeviceLocked"
                    SendApduFailureReason.DeviceNotFound -> "DeviceNotFound"
                    SendApduFailureReason.NoResponse -> "NoResponse"
                    SendApduFailureReason.NoUsbEndpointFound -> "NoUsbEndpointFound"
                    SendApduFailureReason.Unknown -> "Unknown"
                })
            }
        }
    }
}

internal fun TransportEvent.DeviceConnectionLost.toWritableMap(): WritableMap =
    Arguments.createMap().apply {
        putString("id", id)
    }

/* lists */

fun List<DiscoveryDevice>.toWritableArray(): WritableArray =
    Arguments.createArray().apply {
        forEach {
            pushMap(it.toWritableMap())
        }
    }
