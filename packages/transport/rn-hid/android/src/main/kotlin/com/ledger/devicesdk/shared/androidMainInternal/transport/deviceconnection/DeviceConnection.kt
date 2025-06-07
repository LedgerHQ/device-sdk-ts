package com.ledger.devicesdk.shared.androidMainInternal.transport.deviceconnection

import com.ledger.devicesdk.shared.api.apdu.SendApduResult
import com.ledger.devicesdk.shared.internal.service.logger.LoggerService
import com.ledger.devicesdk.shared.internal.service.logger.buildSimpleErrorLogInfo
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import kotlin.time.Duration

internal class DeviceConnection<Dependencies>(
    val sessionId: String,
    private var deviceApduSender: DeviceApduSender<Dependencies>,
    isFatalSendApduFailure: (SendApduResult.Failure) -> Boolean,
    reconnectionTimeoutDuration: Duration,
    coroutineDispatcher: CoroutineDispatcher,
    private val onTerminated: (DeviceConnection<Dependencies>) -> Unit,
    private val loggerService: LoggerService,
) {
    private val stateMachine: DeviceConnectionStateMachine
    private val coroutineScope = CoroutineScope(coroutineDispatcher)

    init {
        stateMachine = DeviceConnectionStateMachine(
            sendApduFn = { apdu, abortTimeoutDuration ->
                coroutineScope.launch {
                    val res = deviceApduSender.send(apdu, abortTimeoutDuration)
                    handleApduResult(res)
                }
            },
            onTerminated = {
                onTerminated(this)
            },
            isFatalSendApduFailure = isFatalSendApduFailure,
            reconnectionTimeoutDuration = reconnectionTimeoutDuration,
            coroutineDispatcher = coroutineDispatcher,
            onError = {
                loggerService.log(
                    buildSimpleErrorLogInfo(
                        "DeviceConnection",
                        "State machine error $it"
                    )
                )
            },
            loggerService = loggerService,
        )
    }


    private fun handleApduResult(result: SendApduResult) {
        stateMachine.handleApduResult(result)
    }

    public fun getApduSender(): DeviceApduSender<Dependencies> {
        return deviceApduSender
    }

    public fun handleDeviceConnected(apduSender: DeviceApduSender<Dependencies>) {
        deviceApduSender = apduSender
        stateMachine.handleDeviceConnected()
    }

    public fun handleDeviceDisconnected() {
        stateMachine.handleDeviceDisconnected()
    }

    public suspend fun requestSendApdu(apdu: ByteArray, triggersDisconnection: Boolean, abortTimeoutDuration: Duration): SendApduResult =
        suspendCoroutine { cont ->
            stateMachine.requestSendApdu(
                DeviceConnectionStateMachine.SendApduRequestContent(
                    apdu = apdu,
                    triggersDisconnection = apduTriggersDisconnection(apdu) || triggersDisconnection,
                    abortTimeoutDuration = abortTimeoutDuration,
                    resultCallback = cont::resume
                )
            )
        }

    public fun requestCloseConnection() {
        stateMachine.requestCloseConnection()
    }

    private fun apduTriggersDisconnection(apdu: ByteArray): Boolean {
        val apduMap = mapOf(
            "openApp" to byteArrayOf(0xe0.toByte(), 0xd8.toByte(), 0x00, 0x00),
            "closeApp" to byteArrayOf(0xb0.toByte(), 0xa7.toByte(), 0x00, 0x00)
        )

        return apduMap.values.any { known ->
            (0 until 4).all { i -> known[i] == apdu[i] }
        }
    }

}