package com.ledger.androidtransporthid
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class TransportHidModule(reactContext: ReactApplicationContext): ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "RCTTransportHIDModule"

    @ReactMethod
    fun test(promise: Promise) {
        promise.resolve("test OK")
    }
}