package com.ledger.devicesdk.shared.androidMainInternal.transport.deviceconnection

import com.ledger.devicesdk.shared.api.apdu.SendApduResult
import com.ledger.devicesdk.shared.internal.service.logger.LoggerService
import com.ledger.devicesdk.shared.internal.service.logger.buildSimpleErrorLogInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import kotlin.time.Duration

internal class DeviceConnection<Dependencies>(
    private var deviceApduSender: DeviceApduSender<Dependencies>,
    isFatalSendApduFailure: (SendApduResult.Failure) -> Boolean,
    reconnectionTimeoutDuration: Duration,
    private val onTerminated: () -> Unit,
    private val coroutineScope: CoroutineScope,
    private val loggerService: LoggerService,
) {
    private val stateMachine: DeviceConnectionStateMachine

    init {
        stateMachine = DeviceConnectionStateMachine(
            sendApduFn = {
                coroutineScope.launch {
                    val res = deviceApduSender.send(it)
                    handleApduResult(res)
                }
            },
            onTerminated = {
                onTerminated()
            },
            closeConnection = {
                coroutineScope.launch {
                    deviceApduSender.closeConnection()
                }
            },
            isFatalSendApduFailure = isFatalSendApduFailure,
            reconnectionTimeoutDuration = reconnectionTimeoutDuration,
            coroutineScope = coroutineScope,
            onError = {
                loggerService.log(
                    buildSimpleErrorLogInfo(
                        "DeviceConnection",
                        "State machine error $it"
                    )
                )
            }
        )
    }

    private fun handleApduResult(result: SendApduResult) {
        stateMachine.handleApduResult(result)
    }

    public fun setApduSender(apduSender: DeviceApduSender<Dependencies>) {
        deviceApduSender = apduSender
    }

    public fun handleDeviceConnected() {
        stateMachine.handleDeviceConnected()
    }

    public fun handleDeviceDisconnected() {
        stateMachine.handleDeviceDisconnected()
    }

    public suspend fun requestSendApdu(apdu: ByteArray): SendApduResult =
        suspendCoroutine { cont ->
            stateMachine.requestSendApdu(
                DeviceConnectionStateMachine.SendApduRequestContent(
                    apdu = apdu,
                    triggersDisconnection = false,
                    resultCallback = cont::resume
                )
            )
        }

    public fun requestCloseConnection() {
        stateMachine.requestCloseConnection()
    }

}