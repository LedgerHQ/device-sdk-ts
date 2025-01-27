package com.ledger.androidtransporthid

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbManager
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.ledger.androidtransporthid.bridge.toWritableMap
import com.ledger.devicesdk.shared.androidMain.transport.usb.AndroidUsbTransport
import com.ledger.devicesdk.shared.androidMain.transport.usb.DefaultAndroidUsbTransport
import com.ledger.devicesdk.shared.androidMain.transport.usb.controller.ACTION_USB_PERMISSION
import com.ledger.devicesdk.shared.androidMain.transport.usb.controller.UsbAttachedReceiverController
import com.ledger.devicesdk.shared.androidMain.transport.usb.controller.UsbDetachedReceiverController
import com.ledger.devicesdk.shared.androidMain.transport.usb.controller.UsbPermissionReceiver
import com.ledger.devicesdk.shared.api.apdu.SendApduResult
import com.ledger.devicesdk.shared.api.connection.ConnectionResult
import com.ledger.devicesdk.shared.api.discovery.DiscoveryDevice
import com.ledger.devicesdk.shared.internal.connection.InternalConnectedDevice
import com.ledger.devicesdk.shared.internal.connection.InternalConnectionResult
import com.ledger.devicesdk.shared.internal.event.SdkEventDispatcher
import com.ledger.devicesdk.shared.internal.transport.TransportEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import timber.log.Timber
import kotlin.random.Random
import kotlin.time.Duration.Companion.milliseconds

class TransportHidModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {
    override fun getName(): String = "RCTTransportHIDModule"

    private var usbPermissionReceiver: UsbPermissionReceiver? = null
    private var usbAttachedReceiverController: UsbAttachedReceiverController? = null
    private var usbDetachedReceiverController: UsbDetachedReceiverController? = null
    private var sdkEventDispatcher: SdkEventDispatcher = SdkEventDispatcher()

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
                            PendingIntent.FLAG_MUTABLE, // TODO: this breaks
                        ),
                    )
                },
                eventDispatcher = sdkEventDispatcher,
                coroutineDispatcher = Dispatchers.IO,
                loggerService = { logInfo ->
                    Timber.tag("RNHIDModule " + logInfo.tag).d(logInfo.message)
                    sendEvent(reactContext, BridgeEvents.TransportLog(logInfo))
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

    private val discoveryDevices: MutableList<DiscoveryDevice> = mutableListOf()
    private val connectedDevices: MutableList<InternalConnectedDevice> = mutableListOf()

    init {
        reactContext.addLifecycleEventListener(this)
        Timber.plant(Timber.DebugTree())
        sdkEventDispatcher.listen().onEach {
            when(it) {
                is TransportEvent.DeviceConnectionLost -> {
                    connectedDevices.removeIf { device -> device.id == it.id }
                }
                else -> {}
            }
        }.launchIn(CoroutineScope(Dispatchers.Default))
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
                discoveryDevices.clear()
                discoveryDevices += it
                sendEvent(reactContext, BridgeEvents.DiscoveredDevices(it))
            }.launchIn(CoroutineScope(Dispatchers.Default))
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject(e); // TODO: resolve with an error rather than reject
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
            promise.reject(e) // TODO: resolve with an error rather than reject
        }
    }

    @ReactMethod()
    fun connectDevice(uid: String, promise: Promise) {
        val device = discoveryDevices.firstOrNull { it.uid == uid }
        if (device == null) {
            // TODO: resolve with an error rather than reject
            promise.reject("[TransportHidModule][connectDevice] Device not found")
            return
        }

        CoroutineScope(Dispatchers.Default).launch {
            try {
                val connectionResult = transport!!.connect(device)
                when(connectionResult) {
                    is InternalConnectionResult.Connected -> {
                        connectedDevices.add(connectionResult.device)
                    }
                    else -> {}
                }
                promise.resolve(connectionResult.toWritableMap())
            } catch (e: Exception) {
                val connectionResult = InternalConnectionResult
                    .ConnectionError(InternalConnectionResult.Failure.Unknown("${e.message}\n${e.cause}"))
                promise.resolve(connectionResult.toWritableMap())
            }
        }
    }

    @ReactMethod
    fun disconnectDevice(sessionId: String, promise: Promise) {
        CoroutineScope(Dispatchers.Default).launch {
            try {
                transport!!.disconnect(sessionId)
                promise.resolve(null);
            } catch (e: Exception) {
                promise.reject(e) // TODO: do not throw, rather resolve with an error
            }
        }
    }

    @ReactMethod
    fun sendApdu(sessionId: String, apduBase64: String, promise: Promise) {
        try {
            val device = connectedDevices.firstOrNull() { it.id == sessionId }
            if (device == null) {
                promise.reject("[TransportHidModule][sendApdu] Device not found") // TODO: resolve with an error rather than reject
                return
            }
            CoroutineScope(Dispatchers.Default).launch {
                try {
                    val apdu: ByteArray = Base64.decode(apduBase64, Base64.DEFAULT)
                    val res = device.sendApduFn(apdu)
                    promise.resolve(res.toWritableMap())
                } catch (e: Exception) {
                    Timber.i("$e, ${e.cause}")
                    promise.reject(e) // TODO: resolve with an error rather than reject
                }
            }
        } catch (e: Exception) {
            Timber.i("$e, ${e.cause}")
            promise.reject(e) // TODO: resolve with an error rather than reject
        }
    }
}