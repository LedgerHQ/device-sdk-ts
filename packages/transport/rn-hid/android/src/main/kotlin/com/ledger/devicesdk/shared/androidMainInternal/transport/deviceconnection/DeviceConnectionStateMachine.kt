package com.ledger.devicesdk.shared.androidMainInternal.transport.deviceconnection

import com.ledger.devicesdk.shared.api.apdu.SendApduFailureReason
import com.ledger.devicesdk.shared.api.apdu.SendApduResult
import com.ledger.devicesdk.shared.api.utils.fromHexStringToBytesOrThrow
import com.ledger.devicesdk.shared.internal.service.logger.LoggerService
import com.ledger.devicesdk.shared.internal.service.logger.buildSimpleDebugLogInfo
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlin.time.Duration

internal class DeviceConnectionStateMachine(
    private val sendApduFn: (apdu: ByteArray, abortTimeoutDuration: Duration) -> Unit,
    private val onTerminated: () -> Unit,
    private val isFatalSendApduFailure: (SendApduResult.Failure) -> Boolean,
    private val reconnectionTimeoutDuration: Duration,
    private val onError: (Throwable) -> Unit,
    private val loggerService: LoggerService,
    coroutineDispatcher: CoroutineDispatcher,
) {
    private val coroutineScope = CoroutineScope(coroutineDispatcher)
    private var state: State = State.Connected

    fun getState() = state

    private fun pushState(newState: State) {

        val currentState = state

        /* STATE EXIT EFFECTS */
        if (newState != currentState) {
            when (currentState) {
                is State.WaitingForDisconnection -> {
                    currentState.requestContent.resultCallback(currentState.result)
                }
                else -> {}
            }
        }

        /* STATE ENTRY EFFECTS */
        when (newState) {
            is State.Connected -> {}
            is State.SendingApdu -> {
                sendApduFn(newState.requestContent.apdu, newState.requestContent.abortTimeoutDuration)
            }

            is State.WaitingForDisconnection -> {
                // TODO: send getAppAndVersion
                sendApduFn ("b0010000".fromHexStringToBytesOrThrow(), Duration.INFINITE)
            }

            is State.WaitingForReconnection -> {
                startReconnectionTimeout()
            }

            is State.WaitingForReconnectionWithQueuedApdu -> {}
            is State.Terminated -> {
                onTerminated()
            }
        }
        this.state = newState
        loggerService.log(buildSimpleDebugLogInfo("DeviceConnectionStateMachine", "-> New state: $newState"))
    }

    private fun handleEvent(event: Event) {
        val logMessage = """
            -> Event received: $event
               In state: $state
        """.trimIndent()
        loggerService.log(buildSimpleDebugLogInfo("DeviceConnectionStateMachine", logMessage))
        when (val currentState = state) {
            is State.Connected -> {
                when (event) {
                    is Event.SendApduRequested -> {
                        pushState(State.SendingApdu(event.requestContent))
                    }

                    is Event.CloseConnectionRequested -> {
                        pushState(State.Terminated)
                    }

                    is Event.DeviceDisconnected -> {
                        pushState(State.WaitingForReconnection)
                    }

                    else -> {
                        onError(Exception("Unhandled event: $event in state: $currentState"))
                    }
                }
            }

            is State.SendingApdu -> {
                when (event) {
                    is Event.ApduResultReceived -> {
                        when (event.result) {
                            is SendApduResult.Success -> {
                                // check if last 2 bytes of APDU are [0x90,OxO0]
                                val apdu = event.result.apdu


                                if (isSuccessApdu(apdu) && currentState.requestContent.triggersDisconnection) {
                                    pushState(State.WaitingForDisconnection(requestContent = currentState.requestContent, result = event.result))
                                } else {
                                    pushState(State.Connected)
                                    currentState.requestContent.resultCallback(event.result)
                                }
                            }
                            is SendApduResult.Failure -> {
                                if (isFatalSendApduFailure(event.result)) {
                                    pushState(State.Terminated)
                                } else {
                                    pushState(State.Connected)
                                }
                                currentState.requestContent.resultCallback(event.result)
                            }
                        }
                    }

                    is Event.CloseConnectionRequested -> {
                        pushState(State.Terminated)
                        currentState.requestContent.resultCallback(
                            SendApduResult.Failure(
                                SendApduFailureReason.DeviceDisconnected
                            )
                        )
                    }

                    is Event.DeviceDisconnected -> {
                        pushState(State.WaitingForReconnection)
                        currentState.requestContent.resultCallback(
                            SendApduResult.Failure(
                                SendApduFailureReason.DeviceDisconnected
                            )
                        )
                    }

                    is Event.SendApduRequested -> {
                        event.requestContent.resultCallback(
                            SendApduResult.Failure(
                                SendApduFailureReason.DeviceBusy
                            )
                        )
                    }

                    else -> {
                        onError(Exception("Unhandled event: $event in state: $currentState"))
                    }
                }
            }

            is State.WaitingForDisconnection -> {
                when (event) {
                    is Event.ApduResultReceived -> {
                        when (event.result) {
                            is SendApduResult.Success -> {
                                val apdu = event.result.apdu
                                if (isSendApduBusyError(apdu)) {
                                    pushState(state) // Loop on same state, will trigger a new send of GetAppAndVersion (entry effect)
                                } else {
                                    pushState(State.Connected)
                                }
                            }
                            is SendApduResult.Failure -> {
                                pushState(State.WaitingForReconnection)
                            }
                        }
                    }
                    is Event.SendApduRequested -> {
                        event.requestContent.resultCallback(
                            SendApduResult.Failure(
                                SendApduFailureReason.DeviceBusy
                            )
                        )
                    }
                    is Event.DeviceDisconnected -> {
                        pushState(State.WaitingForReconnection)
                    }
                    is Event.CloseConnectionRequested -> {
                        pushState(State.Terminated)
                    }
                    else -> {
                        onError(Exception("Unhandled event: $event in state: $currentState"))
                    }
                }
            }

            is State.WaitingForReconnection -> {
                when (event) {
                    is Event.DeviceConnected -> {
                        pushState(State.Connected)
                        cancelReconnectionTimeout()
                    }

                    is Event.SendApduRequested -> {
                        pushState(State.WaitingForReconnectionWithQueuedApdu(event.requestContent))
                    }

                    is Event.WaitingForReconnectionTimedOut,
                    is Event.CloseConnectionRequested -> {
                        pushState(State.Terminated)
                        cancelReconnectionTimeout()
                    }

                    is Event.DeviceDisconnected -> {
                        /**
                         * Do nothing, this will happen if we send an apdu that triggers a
                         * disconnection, because we will move to this state before the disconnection
                         * is detected:
                         *
                         * 1. APDU that triggers a disconnection is sent.
                         * 2. We receive a 0x9000 (success) response.
                         *      -> We go to State.WaitingForReconnection.
                         * 3. Device disconnection is finally detected:
                         *      -> Event.DeviceDisconnected is received here.
                         */
                    }

                    else -> {
                        onError(Exception("Unhandled event: $event in state: $currentState"))
                    }
                }
            }

            is State.WaitingForReconnectionWithQueuedApdu -> {
                when (event) {
                    is Event.DeviceConnected -> {
                        pushState(State.SendingApdu(currentState.requestContent))
                        cancelReconnectionTimeout()
                    }

                    is Event.CloseConnectionRequested,
                    is Event.WaitingForReconnectionTimedOut -> {
                        pushState(State.Terminated)
                        currentState.requestContent.resultCallback(
                            SendApduResult.Failure(
                                SendApduFailureReason.DeviceDisconnected
                            )
                        )
                        cancelReconnectionTimeout()
                    }

                    is Event.SendApduRequested -> {
                        event.requestContent.resultCallback(
                            SendApduResult.Failure(
                                SendApduFailureReason.DeviceBusy
                            )
                        )
                    }

                    is Event.DeviceDisconnected -> {
                        /**
                         * Do nothing, this will happen if we send an apdu that triggers a
                         * disconnection, because we will move to this state before the disconnection
                         * is detected:
                         *
                         * 1. APDU that triggers a disconnection is sent.
                         * 2. We receive a 0x9000 (success) response
                         *      -> We go to State.WaitingForReconnection in anticipation of the disconnection event.
                         * 3. We receive Event.SendApduRequested
                         *      -> We go to WaitingForReconnectionWithQueuedApdu
                         * 4. Device disconnection is finally detected:
                         *      -> Event.DeviceDisconnected is received here.
                         *
                         * It can also happen if the device is disconnected while we are sending an APDU.
                         * cf. description of event below.
                         */
                    }

                    is Event.ApduResultReceived -> {
                        /**
                         * Do nothing, this will happen if while an APDU is being sent,
                         * the device disconnection is detected.
                         * 1. APDU is sent
                         * 2. Device disconnection is detected
                         *      -> Event.DeviceDisconnected is received in SendingApdu state.
                         *      -> We move to WaitingForReconnection state.
                         * 3. The function to send the APDU returns an error because the device is disconnected.
                         *      -> Event.ApduResultReceived(result=Failure()) is received in the
                         *      current state.
                         *
                         *  It's a race condition between step 2 and 3.
                         */
                    }
                }
            }

            is State.Terminated -> {
                onError(Exception("Unhandled event: $event in state: $currentState"))
            }
        }
    }

    private fun  isSuccessApdu(apdu: ByteArray): Boolean {
        val apduSize = apdu.size
        return apduSize >= 2 &&
                apdu[apduSize - 2] == 0x90.toByte() &&
                apdu[apduSize - 1] == 0x00.toByte()
    }

    private fun isSendApduBusyError(apdu: ByteArray): Boolean {
        val apduSize = apdu.size
        return apduSize >= 2 &&
                apdu[apduSize - 2] == 0x66.toByte() &&
                apdu[apduSize - 1] == 0x01.toByte()
    }

    private fun sendGetAppAndVersionApdu() {
        sendApduFn("b0010000".fromHexStringToBytesOrThrow(), Duration.INFINITE)
    }

    private var timeoutJob: Job? = null
    private fun startReconnectionTimeout() {
        // start a timeout and at the end, emit a WaitingForReconnectionTimedOut event
        timeoutJob = coroutineScope.launch {
            kotlinx.coroutines.delay(reconnectionTimeoutDuration)
            handleEvent(Event.WaitingForReconnectionTimedOut)
        }
    }

    private fun cancelReconnectionTimeout() {
        timeoutJob?.cancel()
        timeoutJob = null
    }

    fun requestSendApdu(requestContent: SendApduRequestContent) {
        handleEvent(Event.SendApduRequested(requestContent))
    }

    fun requestCloseConnection() {
        handleEvent(Event.CloseConnectionRequested)
    }

    fun handleApduResult(result: SendApduResult) {
        handleEvent(Event.ApduResultReceived(result))
    }

    fun handleDeviceConnected() {
        handleEvent(Event.DeviceConnected)
    }

    fun handleDeviceDisconnected() {
        handleEvent(Event.DeviceDisconnected)
    }

    data class SendApduRequestContent(
        val apdu: ByteArray,
        val triggersDisconnection: Boolean,
        val abortTimeoutDuration: Duration,
        val resultCallback: (SendApduResult) -> Unit
    )

    sealed class Event {
        data object DeviceConnected : Event()

        data object DeviceDisconnected : Event()

        data class SendApduRequested(
            val requestContent: SendApduRequestContent
        ) : Event()

        data object CloseConnectionRequested : Event()

        data class ApduResultReceived(val result: SendApduResult) : Event()

        data object WaitingForReconnectionTimedOut : Event()
    }

    sealed class State {
        data object Connected : State()

        data class SendingApdu(val requestContent: SendApduRequestContent) : State()

        data object WaitingForReconnection : State()

        data class WaitingForDisconnection(val requestContent: SendApduRequestContent, val result: SendApduResult): State()

        data class WaitingForReconnectionWithQueuedApdu(val requestContent: SendApduRequestContent) :
            State()

        data object Terminated : State()
    }
}