package com.ledger.androidtransporthid

import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.ledger.androidtransporthid.bridge.toWritableArray
import com.ledger.androidtransporthid.bridge.toWritableMap
import com.ledger.devicesdk.shared.api.discovery.DiscoveryDevice
import com.ledger.devicesdk.shared.internal.service.logger.LogInfo
import com.ledger.devicesdk.shared.internal.transport.TransportEvent

internal sealed class EventParams {
    data class WMap(val map: WritableMap): EventParams()
    data class WArray(val arr: WritableArray): EventParams()
    data object Empty: EventParams()
}

internal sealed class BridgeEvents(val eventName: String, val params: EventParams) {
    data class DiscoveredDevices(
        val devices: List<DiscoveryDevice>,
    ): BridgeEvents("DiscoveredDevices", EventParams.WArray(devices.toWritableArray()))
    data class TransportLog(
        val logInfo: LogInfo,
    ): BridgeEvents("TransportLog", EventParams.WMap(logInfo.toWritableMap()));
    data class DeviceDisconnected(
        val deviceConnectionLost: TransportEvent.DeviceConnectionLost,
    ): BridgeEvents("DeviceDisconnected", EventParams.WMap(deviceConnectionLost.toWritableMap()))
}

internal fun sendEvent(reactContext: ReactContext, bridgeEvent: BridgeEvents) {
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(
            bridgeEvent.eventName,
            when (bridgeEvent.params) {
                is EventParams.WMap -> bridgeEvent.params.map
                is EventParams.WArray -> bridgeEvent.params.arr
                is EventParams.Empty -> null
            }
        )
}