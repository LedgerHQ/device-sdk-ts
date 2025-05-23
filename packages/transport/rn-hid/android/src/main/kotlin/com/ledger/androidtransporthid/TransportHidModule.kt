package com.ledger.androidtransporthid

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.hardware.usb.UsbManager
import android.util.Base64
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.ledger.androidtransporthid.bridge.toWritableMap
import com.ledger.devicesdk.shared.androidMain.transport.usb.AndroidUsbTransport
import com.ledger.devicesdk.shared.androidMain.transport.usb.DefaultAndroidUsbTransport
import com.ledger.devicesdk.shared.androidMain.transport.usb.controller.ACTION_USB_PERMISSION
import com.ledger.devicesdk.shared.androidMain.transport.usb.controller.UsbAttachedReceiverController
import com.ledger.devicesdk.shared.androidMain.transport.usb.controller.UsbDetachedReceiverController
import com.ledger.devicesdk.shared.androidMain.transport.usb.controller.UsbPermissionReceiver
import com.ledger.devicesdk.shared.api.apdu.SendApduResult
import com.ledger.devicesdk.shared.api.discovery.DiscoveryDevice
import com.ledger.devicesdk.shared.internal.connection.InternalConnectedDevice
import com.ledger.devicesdk.shared.internal.connection.InternalConnectionResult
import com.ledger.devicesdk.shared.internal.event.SdkEventDispatcher
import com.ledger.devicesdk.shared.internal.service.logger.LoggerService
import com.ledger.devicesdk.shared.internal.service.logger.buildSimpleDebugLogInfo
import com.ledger.devicesdk.shared.internal.transport.TransportEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import timber.log.Timber
import kotlin.random.Random
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds

class TransportHidModule(
    private val reactContext: ReactApplicationContext,
    private val coroutineScope: CoroutineScope
) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {
    override fun getName(): String = "LDMKTransportHIDModule"

    private var usbPermissionReceiver: UsbPermissionReceiver? = null
    private var usbAttachedReceiverController: UsbAttachedReceiverController? = null
    private var usbDetachedReceiverController: UsbDetachedReceiverController? = null
    private var sdkEventDispatcher: SdkEventDispatcher = SdkEventDispatcher()
    private var eventDispatcherListeningJob: Job
    private val loggerService: LoggerService =
        LoggerService { info ->
            Timber.tag("LDMKTransportHIDModule " + info.tag).d(info.message)
            // sendEvent(reactContext, BridgeEvents.TransportLog(info))
        }

    private val transport: AndroidUsbTransport? by lazy {
        val currentActivity = reactContext.currentActivity
        val currentApplication = currentActivity?.application

        var transport: AndroidUsbTransport? = null
        if (currentApplication != null) {
            val usbManager = reactContext.getSystemService(Context.USB_SERVICE) as UsbManager
            transport = DefaultAndroidUsbTransport(
                application = currentApplication,
                usbManager = usbManager,
                permissionRequester = { context, manager, device ->
                    manager.requestPermission(
                        device,
                        PendingIntent.getBroadcast(
                            context,
                            Random.nextInt(),
                            Intent(ACTION_USB_PERMISSION).apply {
                                setPackage(context.packageName)
                            },
                            PendingIntent.FLAG_IMMUTABLE,
                        ),
                    )
                },
                eventDispatcher = sdkEventDispatcher,
                coroutineDispatcher = Dispatchers.IO,
                loggerService = loggerService,
                scanDelay = 500.milliseconds,
            )
            usbPermissionReceiver = UsbPermissionReceiver(
                context = reactContext,
                androidUsbTransport = transport,
                usbManager = usbManager,
                loggerService = loggerService
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
        eventDispatcherListeningJob = sdkEventDispatcher.listen().onEach {
            when (it) {
                is TransportEvent.DeviceConnectionLost -> {
                    Timber.tag("RNHIDModule")
                    Timber.i("TransportEvent.DeviceConnectionLost ${it.id}")
                    connectedDevices.removeIf { device -> device.id == it.id }
                    sendEvent(reactContext, BridgeEvents.DeviceDisconnected(it))
                }

                else -> {}
            }
        }.launchIn(scope = coroutineScope)
    }

    override fun onHostResume() {}

    override fun onHostPause() {}

    override fun onHostDestroy() {
        usbPermissionReceiver?.stop()
        usbAttachedReceiverController?.stop()
        usbDetachedReceiverController?.stop()
        eventDispatcherListeningJob.cancel()
        transport?.stopScan()
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
            }.launchIn(scope = coroutineScope)
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
            promise.reject(e);
        }
    }

    @ReactMethod()
    fun connectDevice(uid: String, promise: Promise) {
        val device = discoveryDevices.firstOrNull { it.uid == uid }
        if (device == null) {
            promise.reject(Exception("[TransportHidModule][connectDevice] Device not found"))
            return
        }

        coroutineScope.launch {
            try {
                val connectionResult = transport!!.connect(device)
                when (connectionResult) {
                    is InternalConnectionResult.Connected -> {
                        connectedDevices.add(connectionResult.device)
                    }

                    else -> {}
                }
                promise.resolve(connectionResult.toWritableMap())
            } catch (e: Exception) {
                promise.reject(e)
            }
        }
    }

    @ReactMethod
    fun disconnectDevice(sessionId: String, promise: Promise) {
        coroutineScope.launch {
            try {
                transport!!.disconnect(sessionId)
                promise.resolve(null);
            } catch (e: Exception) {
                promise.reject(e)
            }
        }
    }

    @ReactMethod
    fun sendApdu(
        sessionId: String,
        apduBase64: String,
        triggersDisconnection: Boolean,
        abortTimeout: Int,
        promise: Promise
    ) {
        // Log PERF: "Timestamp of the start of the function"
        loggerService.log(
            buildSimpleDebugLogInfo(
                "AndroidUsbTransport",
                "PERF: [@ReactMethod sendApdu] called at ${System.currentTimeMillis()}",
            )
        )
        fun logEnd() = run {
            loggerService.log(
                buildSimpleDebugLogInfo(
                    "AndroidUsbTransport",
                    "PERF: [@ReactMethod sendApdu] finished at ${System.currentTimeMillis()}",
                )
            )
        }

        try {
            val device = connectedDevices.firstOrNull() { it.id == sessionId }
            if (device == null) {
                promise.reject(Exception("[TransportHidModule][sendApdu] Device not found"))
                return
            }
            coroutineScope.launch {
                try {
                    val apdu: ByteArray = Base64.decode(apduBase64, Base64.DEFAULT)
                    val abortTimeoutDuration = if (abortTimeout <= 0) Duration.INFINITE else abortTimeout.milliseconds
                    val res =
                        device.sendApduFn(apdu, triggersDisconnection, abortTimeoutDuration)
                    logEnd()
                    promise.resolve(res.toWritableMap())
                } catch (e: Exception) {
                    Timber.i("$e, ${e.cause}")
                    logEnd()
                    promise.reject(e)
                }
            }
        } catch (e: Exception) {
            Timber.i("$e, ${e.cause}")
            logEnd()
            promise.reject(e)
        }
    }

    @ReactMethod
    public fun exchangeBulkApdus(
        sessionId: String,
        apdus: ReadableArray,
        requestId: Int,
        promise: Promise,
    ) {
        // find connected device, loop over all apdus and send them to the device, and send back the last result
        val device = connectedDevices.firstOrNull() { it.id == sessionId }
        if (device == null) {
            promise.reject(Exception("[TransportHidModule][exchangeBulkApdus] Device not found"))
            return
        }
        coroutineScope.launch {
            try {
                val apdusList = apdus.toArrayList()
                val apdusByteArray = apdusList.map { Base64.decode(it as String, Base64.DEFAULT) }
                lateinit var lastResult: SendApduResult
                apdusByteArray.forEachIndexed { index, apdu ->
                    lastResult = device.sendApduFn(apdu, false, Duration.INFINITE)
                    if (index == apdusByteArray.lastIndex || index % 20 == 0) {
                        sendEvent(reactContext, BridgeEvents.ExchangeBulkApdusEvent(ExchangeBulkProgressEvent(requestId, index)))
                    }
                }
                promise.resolve(lastResult.toWritableMap())
            } catch (e: Exception) {
                promise.reject(e)
            }
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Nothing to do in our case, but React Native will issue a warning if this isn't implemented
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Nothing to do in our case, but React Native will issue a warning if this isn't implemented
    }

    data class ExchangeBulkProgressEvent(
        val requestId: Int,
        val index: Int,
    )
}
