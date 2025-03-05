package com.ledger.devicesdk.shared.androidMainInternal.transport.deviceconnection

import com.ledger.devicesdk.shared.api.apdu.SendApduFailureReason
import com.ledger.devicesdk.shared.api.apdu.SendApduResult
import com.ledger.devicesdk.shared.internal.service.logger.LogInfo
import com.ledger.devicesdk.shared.internal.service.logger.LoggerService
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds
import kotlin.test.Test
import org.junit.Assert.*
import kotlin.time.Duration.Companion.milliseconds


class DeviceConnectionStateMachineTest {
    @Test
    fun `send APDU in Connected state`() = runTest {
        var sendApduCalled: ByteArray? = null
        var terminated = false
        var error: Throwable? = null
        var sendApduResult: SendApduResult? = null

        val dispatcher = StandardTestDispatcher(testScheduler)
        val stateMachine = DeviceConnectionStateMachine(
            sendApduFn = { apdu -> sendApduCalled = apdu },
            onTerminated = { terminated = true },
            isFatalSendApduFailure = { false },
            reconnectionTimeoutDuration = reconnectionTimeout,
            onError = { error = it },
            loggerService = FakeLoggerService(),
            coroutineDispatcher = StandardTestDispatcher(testScheduler)
        )

        // Request sending an APDU
        stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
            apdu = mockedRequestApduA,
            triggersDisconnection = false,
            resultCallback = { result -> sendApduResult = result }
        ))
        assertArrayEquals(mockedRequestApduA, sendApduCalled)

        // Simulate a successful response
        val mockedSuccessApduResult = SendApduResult.Success(mockedResultApduSuccessA)
        stateMachine.handleApduResult(mockedSuccessApduResult)

        // Then
        assertEquals(mockedSuccessApduResult, sendApduResult)
        assertFalse(terminated)
        assertNull(error)

        // In Connected state now; closing connection should terminate without an error.
        stateMachine.requestCloseConnection()
        assertTrue(terminated)
        assertNull(error)
    }

    @Test
    fun `fatal failure in SendingApdu state terminates machine and fails APDU request`() = runTest {
        var terminated = false
        var sendApduResult: SendApduResult? = null
        var error: Throwable? = null

        val dispatcher = StandardTestDispatcher(testScheduler)
        val stateMachine = DeviceConnectionStateMachine(
            sendApduFn = { },
            onTerminated = { terminated = true },
            isFatalSendApduFailure = { true }, // All failures are fatal
            reconnectionTimeoutDuration = reconnectionTimeout,
            onError = { error = it },
            loggerService = FakeLoggerService(),
            coroutineDispatcher = StandardTestDispatcher(testScheduler)
        )

        stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
            apdu = mockedRequestApduA,
            triggersDisconnection = false,
            resultCallback = { result -> sendApduResult = result }
        ))

        // Simulate a failure
        val mockedFailureResult = SendApduResult.Failure(SendApduFailureReason.DeviceDisconnected)
        stateMachine.handleApduResult(mockedFailureResult)

        // Then
        assertEquals(sendApduResult, mockedFailureResult)
        assertTrue(terminated)
        assertNull(error)
    }

    @Test
    fun `non-fatal failure in SendingApdu state returns to Connected`() = runTest {
        var terminated = false
        var sendApduResult: SendApduResult? = null
        var error: Throwable? = null

        val dispatcher = StandardTestDispatcher(testScheduler)
        val stateMachine = DeviceConnectionStateMachine(
            sendApduFn = { },
            onTerminated = { terminated = true },
            isFatalSendApduFailure = { false },
            reconnectionTimeoutDuration = reconnectionTimeout,
            onError = { error = it },
            loggerService = FakeLoggerService(),
            coroutineDispatcher = StandardTestDispatcher(testScheduler)
        )

        // Request sending APDU
        stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
            apdu = mockedRequestApduA,
            triggersDisconnection = false,
            resultCallback = { result -> sendApduResult = result }
        ))

        // Simulate a failure
        val mockedFailureResult = SendApduResult.Failure(SendApduFailureReason.ApduNotWellFormatted)
        stateMachine.handleApduResult(mockedFailureResult)

        // Then
        assertEquals(mockedFailureResult, sendApduResult)
        assertFalse(terminated)

        // In Connected state now; closing connection should terminate without an error.
        stateMachine.requestCloseConnection()
        assertTrue(terminated)
        assertNull(error)
    }

    @Test
    fun `successful APDU with triggersDisconnection moves to WaitingForReconnection and recovers when device reconnects`() =
        runTest {
            var sendApduCalled: ByteArray? = null
            var sendApduResult: SendApduResult? = null
            var terminated = false
            var error: Throwable? = null

            val dispatcher = StandardTestDispatcher(testScheduler)
            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { apdu -> sendApduCalled = apdu },
                onTerminated = { terminated = true },
                isFatalSendApduFailure = { false },
                reconnectionTimeoutDuration = reconnectionTimeout,
                onError = { error = it },
                loggerService = FakeLoggerService(),
                coroutineDispatcher = StandardTestDispatcher(testScheduler)
            )

            // Request sending an APDU (with triggersDisconnection = true)
            stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
                apdu = mockedRequestApduA,
                triggersDisconnection = true,
                resultCallback = { result -> sendApduResult = result }
            ))

            // Send APDU should have been called
            assertArrayEquals(mockedRequestApduA, sendApduCalled)

            // Simulate a successful response
            val mockedSuccessApduResult = SendApduResult.Success(mockedResultApduSuccessA)
            stateMachine.handleApduResult(mockedSuccessApduResult)

            // Result should have been returned
            assertEquals(mockedSuccessApduResult, sendApduResult)

            // Should be in waiting state
            assertEquals(
                DeviceConnectionStateMachine.State.WaitingForReconnection,
                stateMachine.getState()
            )

            // Now in WaitingForReconnection; simulate reconnection.
            stateMachine.handleDeviceConnected()

            // A new APDU request in Connected state should call sendApduFn.
            var secondSendApduResult: SendApduResult? = null
            stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
                apdu = mockedRequestApduB,
                triggersDisconnection = false,
                resultCallback = { secondSendApduResult = it }
            ))

            // Send APDU should have been called
            assertArrayEquals(mockedRequestApduB, sendApduCalled)

            // Simulate a successful response
            val mockedSuccessApduResultB = SendApduResult.Success(mockedResultApduSuccessB)
            stateMachine.handleApduResult(mockedSuccessApduResultB)

            // Result should have been returned
            assertEquals(mockedSuccessApduResultB, secondSendApduResult)

            assertFalse(terminated)
            assertNull(error)
        }

    @Test
    fun `successful APDU with triggersDisconnection moves to WaitingForReconnection and next APDU is queued until reconnection`() =
        runTest {
            val sendApduCalled: MutableList<ByteArray> = mutableListOf()
            var terminated = false
            var error: Throwable? = null

            val dispatcher = StandardTestDispatcher(testScheduler)
            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { apdu -> sendApduCalled += apdu },
                onTerminated = { terminated = true },
                isFatalSendApduFailure = { false },
                reconnectionTimeoutDuration = reconnectionTimeout,
                onError = { error = it },
                loggerService = FakeLoggerService(),
                coroutineDispatcher = StandardTestDispatcher(testScheduler)
            )

            // Request sending an APDU (with triggersDisconnection = true)
            stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
                apdu = mockedRequestApduA,
                triggersDisconnection = true,
                resultCallback = { }
            ))

            // Simulate a successful response
            val mockedSuccessApduResult = SendApduResult.Success(mockedResultApduSuccessA)
            stateMachine.handleApduResult(mockedSuccessApduResult)

            // sendApduFn should have been called once
            assertEquals(1, sendApduCalled.size)

            // Should be in waiting state
            assertEquals(
                DeviceConnectionStateMachine.State.WaitingForReconnection,
                stateMachine.getState()
            )

            // Now in WaitingForReconnection; simulate new APDU request
            var secondSendApduResult: SendApduResult? = null
            stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
                apdu = mockedRequestApduB,
                triggersDisconnection = false,
                resultCallback = { secondSendApduResult = it }
            ))

            // Should be in waiting state
            assertEquals(
                DeviceConnectionStateMachine.State.WaitingForReconnectionWithQueuedApdu::class,
                stateMachine.getState()::class
            )

            // sendApduFn should not have been called one more time
            assertEquals(1, sendApduCalled.size)

            // Simulate reconnection
            stateMachine.handleDeviceConnected()

            // Should be in SendingApdu state
            assertEquals(
                DeviceConnectionStateMachine.State.SendingApdu::class,
                stateMachine.getState()::class
            )

            // Send APDU should have been called a second time, and the result should have been returned
            assertEquals(2, sendApduCalled.size)
            assertArrayEquals(mockedRequestApduB, sendApduCalled[1])

            // Simulate a successful response
            val mockedSuccessApduResultB = SendApduResult.Success(mockedResultApduSuccessB)
            stateMachine.handleApduResult(mockedSuccessApduResultB)

            // Should be in Connected state
            assertEquals(
                DeviceConnectionStateMachine.State.Connected,
                stateMachine.getState()
            )

            // Result should have been returned
            assertEquals(mockedSuccessApduResultB, secondSendApduResult)

            assertFalse(terminated)
            assertNull(error)
        }

    @Test
    fun `close connection during SendingApdu state terminates and fails APDU request`() = runTest {
        var terminated = false
        var sendApduResult: SendApduResult? = null
        var error: Throwable? = null

        val dispatcher = StandardTestDispatcher(testScheduler)
        val stateMachine = DeviceConnectionStateMachine(
            sendApduFn = { },
            onTerminated = { terminated = true },
            isFatalSendApduFailure = { false },
            reconnectionTimeoutDuration = reconnectionTimeout,
            onError = { error = it },
            loggerService = FakeLoggerService(),
            coroutineDispatcher = StandardTestDispatcher(testScheduler)
        )

        // Request sending an APDU
        stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
            apdu = mockedRequestApduA,
            triggersDisconnection = false,
            resultCallback = { result -> sendApduResult = result }
        ))

        // Should be in sending state
        assertEquals(
            DeviceConnectionStateMachine.State.SendingApdu::class,
            stateMachine.getState()::class
        )

        // Close connection
        stateMachine.requestCloseConnection()

        // Failure result should have been returned
        assertEquals(
            SendApduResult.Failure(SendApduFailureReason.DeviceDisconnected),
            sendApduResult
        )
        assertTrue(terminated)
        assertNull(error)
    }

    @Test
    fun `device disconnected during SendingApdu state fails APDU and moves to waiting state`() =
        runTest {
            var sendApduResult: SendApduResult? = null
            var terminated = false
            var error: Throwable? = null

            val dispatcher = StandardTestDispatcher(testScheduler)
            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { },
                onTerminated = { terminated = true },
                isFatalSendApduFailure = { false },
                reconnectionTimeoutDuration = reconnectionTimeout,
                onError = { error = it },
                loggerService = FakeLoggerService(),
                coroutineDispatcher = StandardTestDispatcher(testScheduler)
            )

            // Request sending an APDU
            stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
                apdu = mockedRequestApduA,
                triggersDisconnection = false,
                resultCallback = { result -> sendApduResult = result }
            ))

            // Simulate a disconnection
            stateMachine.handleDeviceDisconnected()

            // Should be in waiting state
            assertEquals(
                DeviceConnectionStateMachine.State.WaitingForReconnection,
                stateMachine.getState()
            )

            // Failure result should have been returned
            assertEquals(
                SendApduResult.Failure(SendApduFailureReason.DeviceDisconnected),
                sendApduResult
            )

            // Should be in waiting state
            assertEquals(
                DeviceConnectionStateMachine.State.WaitingForReconnection,
                stateMachine.getState()
            )

            // Simulate reconnection to return to normal operation.
            stateMachine.handleDeviceConnected()

            assertFalse(terminated)
            assertNull(error)
        }

    @Test
    fun `APDU request received while busy returns DeviceBusy failure`() = runTest {
        var firstSendApduResult: SendApduResult? = null
        var secondSendApduResult: SendApduResult? = null
        var terminated = false
        var error: Throwable? = null

        val dispatcher = StandardTestDispatcher(testScheduler)
        val stateMachine = DeviceConnectionStateMachine(
            sendApduFn = { },
            onTerminated = { terminated = true },
            isFatalSendApduFailure = { false },
            reconnectionTimeoutDuration = reconnectionTimeout,
            onError = { error = it },
            loggerService = FakeLoggerService(),
            coroutineDispatcher = StandardTestDispatcher(testScheduler)
        )

        // First request enters SendingApdu.
        stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
            apdu = mockedRequestApduA,
            triggersDisconnection = false,
            resultCallback = { firstSendApduResult = it }
        ))

        // Should be in sending state.
        assertEquals(
            DeviceConnectionStateMachine.State.SendingApdu::class,
            stateMachine.getState()::class
        )

        // Second request while busy.
        stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
            apdu = mockedRequestApduB,
            triggersDisconnection = false,
            resultCallback = { secondSendApduResult = it }
        ))

        assertEquals(SendApduResult.Failure(SendApduFailureReason.DeviceBusy), secondSendApduResult)

        // Simulate response to first request
        val mockedSuccessApduResult = SendApduResult.Success(mockedResultApduSuccessA)
        stateMachine.handleApduResult(mockedSuccessApduResult)

        // First request should have succeeded
        assertEquals(mockedSuccessApduResult, firstSendApduResult)

        assertFalse(terminated)
        assertNull(error)
    }

    @Test
    fun `waiting for reconnection transitions to Connected on device connected`() = runTest {
        var terminated = false

        val stateMachine = DeviceConnectionStateMachine(
            sendApduFn = { },
            onTerminated = { terminated = true },
            isFatalSendApduFailure = { false },
            reconnectionTimeoutDuration = reconnectionTimeout,
            onError = { },
            loggerService = FakeLoggerService(),
            coroutineDispatcher = StandardTestDispatcher(testScheduler)
        )

        // Simulate disconnection to move to waiting state.
        stateMachine.handleDeviceDisconnected()

        // Should be in waiting state.
        assertEquals(
            DeviceConnectionStateMachine.State.WaitingForReconnection,
            stateMachine.getState()
        )

        // Then simulate reconnection.
        stateMachine.handleDeviceConnected()

        // Should be in connected state.
        assertEquals(
            DeviceConnectionStateMachine.State.Connected,
            stateMachine.getState()
        )

        // If no error and no termination, we assume state is Connected.
        assertFalse(terminated)
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    @Test
    fun `waiting for reconnection times out and terminates`() = runTest {
        var terminated = false

        val stateMachine = DeviceConnectionStateMachine(
            sendApduFn = { },
            onTerminated = { terminated = true },
            isFatalSendApduFailure = { false },
            reconnectionTimeoutDuration = 5.seconds,
            onError = { },
            loggerService = FakeLoggerService(),
            coroutineDispatcher = StandardTestDispatcher(testScheduler)
        )

        // Simulate disconnection to move to waiting state.
        stateMachine.handleDeviceDisconnected()

        // Should be in waiting state.
        assertEquals(
            DeviceConnectionStateMachine.State.WaitingForReconnection,
            stateMachine.getState()
        )

        // Simulate timeout
        advanceTimeBy(5.seconds)
        assertFalse(terminated)

        advanceTimeBy(1.milliseconds)
        assertTrue(terminated)
    }

    @Test
    fun `queued APDU in waiting state sends APDU on device connected`() = runTest {
        var sendApduCalled: ByteArray? = null
        var sendApduResult: SendApduResult? = null
        var terminated = false
        var error: Throwable? = null

        val stateMachine = DeviceConnectionStateMachine(
            sendApduFn = { apdu -> sendApduCalled = apdu },
            onTerminated = { terminated = true },
            isFatalSendApduFailure = { false },
            reconnectionTimeoutDuration = 5.seconds,
            onError = { error = it },
            loggerService = FakeLoggerService(),
            coroutineDispatcher = StandardTestDispatcher(testScheduler)
        )

        // Simulate disconnection
        stateMachine.handleDeviceDisconnected()

        // Request sending an APDU
        stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
            apdu = mockedRequestApduA,
            triggersDisconnection = false,
            resultCallback = { sendApduResult = it }
        ))

        // Send APDU should not have been called
        assertNull(sendApduCalled)

        // Simulate reconnection
        stateMachine.handleDeviceConnected()
        assertEquals(mockedRequestApduA, sendApduCalled)

        // Simulate response
        val mockedApduResult = SendApduResult.Success(mockedResultApduSuccessA)
        stateMachine.handleApduResult(mockedApduResult)

        // Callback should have been called
        assertEquals(sendApduResult, mockedApduResult)

        assertNull(error)
        assertFalse(terminated)
    }

    @Test
    fun `closing connection while there is a queued APDU terminates and fails the APDU request`() =
        runTest {
            var terminated = false
            var sendApduResult: SendApduResult? = null
            var error: Throwable? = null

            val dispatcher = StandardTestDispatcher(testScheduler)
            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { },
                onTerminated = { terminated = true },
                isFatalSendApduFailure = { false },
                reconnectionTimeoutDuration = 5.seconds,
                onError = { error = it },
                loggerService = FakeLoggerService(),
                coroutineDispatcher = StandardTestDispatcher(testScheduler)
            )

            // Simulate disconnection
            stateMachine.handleDeviceDisconnected()

            // Request sending an APDU
            stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
                apdu = mockedRequestApduA,
                triggersDisconnection = false,
                resultCallback = { result -> sendApduResult = result }
            ))

            // Request closing the connection
            stateMachine.requestCloseConnection()

            // APDU request should have failed
            assertEquals(
                SendApduResult.Failure(SendApduFailureReason.DeviceDisconnected),
                sendApduResult
            )

            assertTrue(terminated)
            assertNull(error)
        }

    @OptIn(ExperimentalCoroutinesApi::class)
    @Test
    fun `timeout while there is a queued APDU terminates and fails the APDU request`() = runTest {
        var sendApduResult: SendApduResult? = null
        var terminated = false
        var error: Throwable? = null

        val stateMachine = DeviceConnectionStateMachine(
            sendApduFn = { },
            onTerminated = { terminated = true },
            isFatalSendApduFailure = { false },
            reconnectionTimeoutDuration = 5.seconds,
            onError = { error = it },
            loggerService = FakeLoggerService(),
            coroutineDispatcher = StandardTestDispatcher(testScheduler)
        )

        // Simulate disconnection
        stateMachine.handleDeviceDisconnected()

        // Request sending an APDU
        stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
            apdu = byteArrayOf(0x0A),
            triggersDisconnection = false,
            resultCallback = { result -> sendApduResult = result }
        ))

        // Simulate timeout
        advanceTimeBy(5.seconds + 1.milliseconds)
        assertEquals(
            SendApduResult.Failure(SendApduFailureReason.DeviceDisconnected),
            sendApduResult
        )

        assertTrue(terminated)
        assertNull(error)
    }

    @Test
    fun `new APDU request in queued state returns DeviceBusy`() = runTest {
        var firstSendApduResult: SendApduResult? = null
        var secondSendApduResult: SendApduResult? = null
        var terminated = false
        var error: Throwable? = null

        val stateMachine = DeviceConnectionStateMachine(
            sendApduFn = { },
            onTerminated = { terminated = true },
            isFatalSendApduFailure = { false },
            reconnectionTimeoutDuration = 5.seconds,
            onError = { error = it },
            loggerService = FakeLoggerService(),
            coroutineDispatcher = StandardTestDispatcher(testScheduler)
        )

        // Simulate disconnection
        stateMachine.handleDeviceDisconnected()

        // Request sending an APDU
        stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
            apdu = byteArrayOf(0x0A),
            triggersDisconnection = false,
            resultCallback = { firstSendApduResult = it }
        ))

        // Second APDU sending request
        stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
            apdu = byteArrayOf(0x0B),
            triggersDisconnection = false,
            resultCallback = { secondSendApduResult = it }
        ))

        // Second request should immediately return busy.
        assertEquals(SendApduResult.Failure(SendApduFailureReason.DeviceBusy), secondSendApduResult)

        // Simulate reconnection
        stateMachine.handleDeviceConnected()

        // Simulate response (to first request)
        val mockedApduResult = SendApduResult.Success(mockedResultApduSuccessA)
        stateMachine.handleApduResult(mockedApduResult)

        // First Request should have received a result
        assertEquals(mockedApduResult, firstSendApduResult)

        assertFalse(terminated)
        assertNull(error)
    }

    @Test
    fun `any event in Terminated state triggers onError`() = runTest {
        var errorCalled: Throwable? = null

        val stateMachine = DeviceConnectionStateMachine(
            sendApduFn = { },
            onTerminated = { },
            isFatalSendApduFailure = { false },
            reconnectionTimeoutDuration = reconnectionTimeout,
            onError = { errorCalled = it },
            loggerService = FakeLoggerService(),
            coroutineDispatcher = StandardTestDispatcher(testScheduler)
        )

        // Terminate machine.
        stateMachine.requestCloseConnection()
        // Any subsequent event in Terminated state (e.g. device connected) is unhandled.
        stateMachine.handleDeviceConnected()
        assertNotNull(errorCalled)
    }

    companion object {
        internal class FakeLoggerService : LoggerService {
            override fun log(info: LogInfo) {}
        }

        val reconnectionTimeout: Duration = 5.seconds
        val mockedRequestApduA: ByteArray = byteArrayOf(0x01, 0x02)
        val mockedRequestApduB: ByteArray = byteArrayOf(0x03, 0x04)
        val mockedResultApduSuccessA: ByteArray = byteArrayOf(0x05, 0x06, 0x90.toByte(), 0x00)
        val mockedResultApduSuccessB: ByteArray = byteArrayOf(0x07, 0x08, 0x90.toByte(), 0x00)
    }
}