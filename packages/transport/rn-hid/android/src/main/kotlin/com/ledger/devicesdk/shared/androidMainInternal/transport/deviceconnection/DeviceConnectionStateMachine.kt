package com.ledger.devicesdk.shared.androidMainInternal.transport.deviceconnection

import com.ledger.devicesdk.shared.api.apdu.SendApduFailureReason
import com.ledger.devicesdk.shared.api.apdu.SendApduResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlin.time.Duration

internal class DeviceConnectionStateMachine(
    private val sendApduFn: (apdu: ByteArray) -> Unit,
    private val closeConnection: () -> Unit,
    private val onTerminated: () -> Unit,
    private val isFatalSendApduFailure: (SendApduResult.Failure) -> Boolean,
    private val reconnectionTimeoutDuration: Duration,
    private val coroutineScope: CoroutineScope,
    private val onError: (Throwable) -> Unit,
) {

    private var state: State = State.Connected

    private fun pushState(newState: State) {
        when (newState) {
            is State.Connected -> {}
            is State.SendingApdu -> {
                sendApduFn(newState.requestContent.apdu)
            }

            is State.WaitingForReconnection -> {
                startReconnectionTimeout()
            }

            is State.WaitingForReconnectionWithQueuedApdu -> {}
            is State.Terminated -> {
                onTerminated()
                closeConnection()
            }
        }
        this.state = newState
    }

    private fun handleEvent(event: Event) {
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
                            is SendApduResult.Failure -> {
                                if (isFatalSendApduFailure(event.result)) {
                                    pushState(State.Terminated)
                                } else {
                                    pushState(State.Connected)
                                }
                            }

                            is SendApduResult.Success -> {
                                // check if last 2 bytes of APDU are [0x90,OxO0]
                                val apdu = event.result.apdu
                                val apduSize = apdu.size
                                val isSuccessApdu =
                                    apdu.size >= 2 &&
                                            apdu[apduSize - 2] == 0x90.toByte() &&
                                            apdu[apduSize - 1] == 0x00.toByte()

                                if (isSuccessApdu && currentState.requestContent.triggersDisconnection) {
                                    pushState(State.WaitingForReconnection)
                                } else {
                                    pushState(State.Connected)
                                }
                            }
                        }
                        currentState.requestContent.resultCallback(event.result)
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
                         * is detected.
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

                    else -> {
                        onError(Exception("Unhandled event: $event in state: $currentState"))
                    }
                }
            }

            is State.Terminated -> {
                onError(Exception("Unhandled event: $event in state: $currentState"))
            }
        }
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

    public fun requestSendApdu(requestContent: SendApduRequestContent) {
        handleEvent(Event.SendApduRequested(requestContent))
    }

    public fun requestCloseConnection() {
        handleEvent(Event.CloseConnectionRequested)
    }

    public fun handleApduResult(result: SendApduResult) {
        handleEvent(Event.ApduResultReceived(result))
    }

    public fun handleDeviceConnected() {
        handleEvent(Event.DeviceConnected)
    }

    public fun handleDeviceDisconnected() {
        handleEvent(Event.DeviceDisconnected)
    }

    data class SendApduRequestContent(
        val apdu: ByteArray,
        val triggersDisconnection: Boolean,
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

        data class WaitingForReconnectionWithQueuedApdu(val requestContent: SendApduRequestContent) :
            State()

        data object Terminated : State()
    }
}