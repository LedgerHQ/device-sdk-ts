package com.ledger.devicesdk.shared.internal.event

import com.ledger.devicesdk.shared.internal.coroutine.sdkScope
import com.ledger.devicesdk.shared.internal.transport.TransportEvent
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch

internal class SdkEventDispatcher  {
    private val eventFlow: MutableSharedFlow<TransportEvent> = MutableSharedFlow()

    fun listen(): Flow<TransportEvent> = eventFlow

    fun dispatch(event: TransportEvent) {
        sdkScope.launch {
            eventFlow.emit(value = event)
        }
    }
}