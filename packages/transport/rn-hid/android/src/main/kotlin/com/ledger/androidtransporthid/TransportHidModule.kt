package com.ledger.androidtransporthid

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbManager
import android.util.Log
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.ledger.devicesdk.shared.androidMain.transport.usb.AndroidUsbTransport
import com.ledger.devicesdk.shared.androidMain.transport.usb.DefaultAndroidUsbTransport
import com.ledger.devicesdk.shared.androidMain.transport.usb.controller.ACTION_USB_PERMISSION
import com.ledger.devicesdk.shared.androidMain.transport.usb.controller.UsbAttachedReceiverController
import com.ledger.devicesdk.shared.androidMain.transport.usb.controller.UsbDetachedReceiverController
import com.ledger.devicesdk.shared.androidMain.transport.usb.controller.UsbPermissionReceiver
import com.ledger.devicesdk.shared.internal.event.SdkEventDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlin.random.Random
import kotlin.time.Duration.Companion.milliseconds

class TransportHidModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {
    override fun getName(): String = "RCTTransportHIDModule"

    private var usbPermissionReceiver: UsbPermissionReceiver? = null
    private var usbAttachedReceiverController: UsbAttachedReceiverController? = null
    private var usbDetachedReceiverController: UsbDetachedReceiverController? = null

    private val transport: AndroidUsbTransport? by lazy {
        val currentActivity = reactContext.currentActivity
        val currentApplication = currentActivity?.application

        var transport: AndroidUsbTransport? = null
        if (currentApplication != null) {
            transport = DefaultAndroidUsbTransport(
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
                    Log.d("RNHIDModule[transport logs] " + logInfo.tag, logInfo.message)
                    sendEvent(reactContext, BridgeEvents.TransportLog(logInfo))
                    // Timber.tag("RNHIDModule " + logInfo.tag).d(logInfo.message)
                },
                scanDelay = 500.milliseconds,
            )
            usbPermissionReceiver = UsbPermissionReceiver(
                context = reactContext,
                androidUsbTransport = transport,
            )
            usbDetachedReceiverController = UsbDetachedReceiverController(
                context = reactContext,
                androidUsbTransport = transport,
            )
            usbAttachedReceiverController = UsbAttachedReceiverController(
                context = reactContext,
                androidUsbTransport = transport,
            )
            usbPermissionReceiver!!.start()
            usbAttachedReceiverController!!.start()
            usbDetachedReceiverController!!.start()
        }
        transport
    }

    init {
        Log.d("RNHIDModule", "init")
        reactContext.addLifecycleEventListener(this)
    }

    override fun onHostResume() {}

    override fun onHostPause() {}

    override fun onHostDestroy() {
        usbPermissionReceiver?.stop()
        usbAttachedReceiverController?.stop()
        usbDetachedReceiverController?.stop()
    }

    private var discoveryCount = 0
    @ReactMethod
    fun startScan(promise: Promise) {
        discoveryCount += 1
        if (discoveryCount > 1) {
            promise.resolve(null)
            return
        }
        try {
            transport!!.startScan().onEach {
                sendEvent(reactContext, BridgeEvents.DiscoveredDevices(it))
            }.launchIn(CoroutineScope(Dispatchers.Default))
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject(e);
        }
    }

    @ReactMethod
    fun stopScan(promise: Promise) {
        discoveryCount -= 1
        if (discoveryCount > 0) {
            promise.resolve(null)
            return
        }
        try {
            transport!!.stopScan()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject(e)
        }
    }
}