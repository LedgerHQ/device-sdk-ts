package com.ledger.androidtransporthid
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbManager
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.ledger.devicesdk.shared.androidMain.transport.usb.AndroidUsbTransport
import com.ledger.devicesdk.shared.androidMain.transport.usb.DefaultAndroidUsbTransport
import com.ledger.devicesdk.shared.androidMain.transport.usb.controller.ACTION_USB_PERMISSION
import com.ledger.devicesdk.shared.internal.event.SdkEventDispatcher
import kotlinx.coroutines.Dispatchers
import timber.log.Timber
import kotlin.math.log
import kotlin.random.Random
import kotlin.time.Duration.Companion.milliseconds

class TransportHidModule(private val reactContext: ReactApplicationContext): ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "RCTTransportHIDModule"

    override fun initialize() {
        super.initialize()

        val currentActivity = reactContext.currentActivity ?: return
        val currentApplication = currentActivity.application ?: return

        val transport: AndroidUsbTransport = DefaultAndroidUsbTransport(
            application = currentApplication,
            usbManager = reactContext.getSystemService(Context.USB_SERVICE) as UsbManager,
            permissionRequester = { context, manager, device ->
                manager.requestPermission(
                    device,
                    PendingIntent.getBroadcast(
                        context,
                        Random.nextInt(),
                        Intent(ACTION_USB_PERMISSION),
                        PendingIntent.FLAG_MUTABLE,
                    ),
                )
            },
            eventDispatcher = SdkEventDispatcher(),
            coroutineDispatcher = Dispatchers.IO,
            loggerService = { logInfo ->
                Timber.tag(logInfo.tag).d(logInfo.message)
            },
            scanDelay = 500.milliseconds,
        )
    }

    @ReactMethod
    fun test(promise: Promise) {
        promise.resolve("test OK")
    }
}