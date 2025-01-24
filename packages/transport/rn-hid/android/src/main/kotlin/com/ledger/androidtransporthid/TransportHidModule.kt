package com.ledger.androidtransporthid
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbManager
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.onEach
import timber.log.Timber
import kotlin.random.Random
import kotlin.time.Duration.Companion.milliseconds

class TransportHidModule(private val reactContext: ReactApplicationContext): ReactContextBaseJavaModule(reactContext), LifecycleEventListener {
    override fun getName(): String = "RCTTransportHIDModule"

    private var transport: AndroidUsbTransport? = null
    private var usbPermissionReceiver: UsbPermissionReceiver? = null
    private var usbAttachedReceiverController: UsbAttachedReceiverController? = null
    private var usbDetachedReceiverController: UsbDetachedReceiverController? = null

    init {
        reactContext.addLifecycleEventListener(this)
        start()
    }

    private fun start() {
        val currentActivity = reactContext.currentActivity
        val currentApplication = currentActivity?.application

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
                    Timber.tag(logInfo.tag).d(logInfo.message)
                },
                scanDelay = 500.milliseconds,
            )
            usbPermissionReceiver = UsbPermissionReceiver(
                context = reactContext,
                androidUsbTransport = transport as DefaultAndroidUsbTransport,
            )
            usbDetachedReceiverController = UsbDetachedReceiverController(
                context = reactContext,
                androidUsbTransport = transport as DefaultAndroidUsbTransport,
            )
            usbAttachedReceiverController = UsbAttachedReceiverController(
                context = reactContext,
                androidUsbTransport = transport as DefaultAndroidUsbTransport,
            )
            usbPermissionReceiver!!.start()
            usbAttachedReceiverController!!.start()
            usbDetachedReceiverController!!.start()
        }
    }

    override fun onHostResume() {}

    override fun onHostPause() {}

    override fun onHostDestroy() {
        usbPermissionReceiver?.stop()
        usbAttachedReceiverController?.stop()
        usbDetachedReceiverController?.stop()
    }

    @ReactMethod
    fun startDiscovering(promise: Promise) {
        try {
            transport?.startScan()?.onEach {
                sendEvent(reactContext, BridgeEvents.DiscoveredDevices(it))
            }
            promise.resolve(null)
        } catch(e: Exception) {
            promise.reject(e);
        }
    }

    @ReactMethod
    fun stopDiscovering(promise: Promise) {
        try {
            transport?.stopScan()
            promise.resolve(null)
        } catch(e: Exception) {
            promise.reject(e)
        }
    }

    @ReactMethod
    fun test(promise: Promise) {
        promise.resolve("test OK")
    }
}