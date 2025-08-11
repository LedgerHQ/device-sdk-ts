package com.ledger.devicesdk.shared.androidMainInternal.transport.deviceconnection

import com.ledger.devicesdk.shared.api.apdu.SendApduFailureReason
import com.ledger.devicesdk.shared.api.apdu.SendApduResult
import com.ledger.devicesdk.shared.api.utils.fromHexStringToBytesOrThrow
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
import kotlin.test.assertIs
import kotlin.time.Duration.Companion.milliseconds

@OptIn(ExperimentalCoroutinesApi::class)
class DeviceConnectionStateMachineTest {
    @Test
    fun `GIVEN the device connection state machine in Connected state WHEN an APDU is sent THEN the APDU is processed`() =
        runTest {
            var sendApduCalled: ByteArray? = null
            var terminated = false
            var error: Throwable? = null
            var sendApduResult: SendApduResult? = null

            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { apdu, _ -> sendApduCalled = apdu },
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
                resultCallback = { result -> sendApduResult = result },
                abortTimeoutDuration = Duration.INFINITE
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
    fun `GIVEN the device connection state machine in SendingApdu state WHEN a fatal failure occurs THEN the machine terminates and the APDU request fails`() =
        runTest {
            var terminated = false
            var sendApduResult: SendApduResult? = null
            var error: Throwable? = null

            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { _, _ -> },
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
                resultCallback = { result -> sendApduResult = result },
                abortTimeoutDuration = Duration.INFINITE
            ))

            // Simulate a failure
            val mockedFailureResult =
                SendApduResult.Failure(SendApduFailureReason.DeviceDisconnected)
            stateMachine.handleApduResult(mockedFailureResult)

            // Then
            assertEquals(mockedFailureResult, sendApduResult)
            assertTrue(terminated)
            assertNull(error)
        }

    @Test
    fun `GIVEN the device connection state machine in SendingApdu state WHEN a nonfatal failure occurs THEN the machine returns to Connected state`() =
        runTest {
            var terminated = false
            var sendApduResult: SendApduResult? = null
            var error: Throwable? = null

            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { _, _ -> },
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
                resultCallback = { result -> sendApduResult = result },
                abortTimeoutDuration = Duration.INFINITE
            ))

            // Simulate a failure
            val mockedFailureResult =
                SendApduResult.Failure(SendApduFailureReason.ApduNotWellFormatted)
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
    fun `GIVEN the device connection state machine WHEN an APDU with triggersDisconnection is sent and triggers a disconnection THEN the machine moves to WaitingForReconnection and recovers when device reconnects`() =
        runTest {
            var sendApduCalled: ByteArray? = null
            var sendApduResult: SendApduResult? = null
            var terminated = false
            var error: Throwable? = null

            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { apdu, _ -> sendApduCalled = apdu },
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
                resultCallback = { result -> sendApduResult = result },
                abortTimeoutDuration = Duration.INFINITE
            ))

            // Send APDU should have been called
            assertArrayEquals(mockedRequestApduA, sendApduCalled)

            // Simulate a successful response
            val mockedSuccessApduResult = SendApduResult.Success(mockedResultApduSuccessA)
            stateMachine.handleApduResult(mockedSuccessApduResult)

            assertNull(sendApduResult)
            // Simulate a disconnection
            stateMachine.handleDeviceDisconnected()

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
                resultCallback = { secondSendApduResult = it },
                abortTimeoutDuration = Duration.INFINITE
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
    fun `GIVEN the device connection state machine WHEN an APDU with triggersDisconnection is sent and device does not disconnect THEN the machine moves to Connected`() =
        runTest {
            var sendApduCalled: ByteArray? = null
            var sendApduResult: SendApduResult? = null
            var terminated = false
            var error: Throwable? = null

            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { apdu, _ -> sendApduCalled = apdu },
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
                resultCallback = { result -> sendApduResult = result },
                abortTimeoutDuration = Duration.INFINITE
            ))

            // Send APDU should have been called
            assertArrayEquals(mockedRequestApduA, sendApduCalled)

            // Simulate a successful response
            val mockedSuccessApduResult = SendApduResult.Success(mockedResultApduSuccessA)
            stateMachine.handleApduResult(mockedSuccessApduResult)

            assertNull(sendApduResult)

            // Simulate Response from GetAppAndVersion
            val mockedSuccessApduResultGetAppAndVersion = SendApduResult.Success(mockedGetAppAndVersionSuccessfulResponse)
            stateMachine.handleApduResult(mockedSuccessApduResultGetAppAndVersion)

            // Should be in Connected state
            assertEquals(
                DeviceConnectionStateMachine.State.Connected,
                stateMachine.getState()
            )

            // Response should have been returned
            assertEquals(mockedSuccessApduResult, sendApduResult)
        }

    @Test
    fun `GIVEN the device connection state machine WHEN an APDU with triggersDisconnection is sent and device does not disconnect but is first busy THEN the machine retries and moves to Connected`() =
        runTest {
            var sendApduCalled: ByteArray? = null
            var sendApduResult: SendApduResult? = null
            var terminated = false
            var error: Throwable? = null

            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { apdu, _ -> sendApduCalled = apdu },
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
                resultCallback = { result -> sendApduResult = result },
                abortTimeoutDuration = Duration.INFINITE
            ))

            // Send APDU should have been called
            assertArrayEquals(mockedRequestApduA, sendApduCalled)

            // Simulate a successful response
            val mockedSuccessApduResult = SendApduResult.Success(mockedResultApduSuccessA)
            stateMachine.handleApduResult(mockedSuccessApduResult)

            assertNull(sendApduResult)

            assertIs<DeviceConnectionStateMachine.State.WaitingForDisconnection>(
                stateMachine.getState()
            )

            // Simulate Busy Response from GetAppAndVersion
            val mockedBusyApduResultGetAppAndVersion = SendApduResult.Success(mockedGetAppAndVersionBusyResponse)
            stateMachine.handleApduResult(mockedBusyApduResultGetAppAndVersion)

            assertIs<DeviceConnectionStateMachine.State.WaitingForDisconnection>(
                stateMachine.getState()
            )

            // Simulate Successful Response from GetAppAndVersion
            val mockedSuccessApduResultGetAppAndVersion = SendApduResult.Success(mockedGetAppAndVersionSuccessfulResponse)
            stateMachine.handleApduResult(mockedSuccessApduResultGetAppAndVersion)

            // Should be in Connected state
            assertEquals(
                DeviceConnectionStateMachine.State.Connected,
                stateMachine.getState()
            )

            // Response should have been returned
            assertEquals(mockedSuccessApduResult, sendApduResult)
        }


    @Test
    fun `GIVEN the device connection state machine WHEN an APDU with triggersDisconnection is sent and triggers a disconnection THEN the machine moves to WaitingForReconnection and the next APDU is queued until reconnection`() =
        runTest {
            val sendApduCalled: MutableList<ByteArray> = mutableListOf()
            var terminated = false
            var error: Throwable? = null

            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { apdu, _ -> sendApduCalled += apdu },
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
                resultCallback = { },
                abortTimeoutDuration = Duration.INFINITE
            ))

            // Simulate a successful response
            val mockedSuccessApduResult = SendApduResult.Success(mockedResultApduSuccessA)
            stateMachine.handleApduResult(mockedSuccessApduResult)

            // sendApduFn should have been called twice (for the mockedRequestApduA and an extra call for the getAppAndVersion APDU)
            assertEquals(2, sendApduCalled.size)

            // Should be in WaitingForDisconnection state
            assertIs<DeviceConnectionStateMachine.State.WaitingForDisconnection>(
                stateMachine.getState()
            )

            // Simulate disconnection
            stateMachine.handleDeviceDisconnected()

            // Should be in WaitingForReconnection state

            assertEquals(
                DeviceConnectionStateMachine.State.WaitingForReconnection,
                stateMachine.getState()
            )

            // Now in WaitingForReconnection; simulate new APDU request
            var secondSendApduResult: SendApduResult? = null
            stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
                apdu = mockedRequestApduB,
                triggersDisconnection = false,
                resultCallback = { secondSendApduResult = it },
                abortTimeoutDuration = Duration.INFINITE
            ))

            // Should be in waiting state
            assertEquals(
                DeviceConnectionStateMachine.State.WaitingForReconnectionWithQueuedApdu::class,
                stateMachine.getState()::class
            )

            // sendApduFn should not have been called one more time
            assertEquals(2, sendApduCalled.size)

            // Simulate reconnection
            stateMachine.handleDeviceConnected()

            // Should be in SendingApdu state
            assertEquals(
                DeviceConnectionStateMachine.State.SendingApdu::class,
                stateMachine.getState()::class
            )

            // Send APDU should have been called a 3rd time, and the result should have been returned
            assertEquals(3, sendApduCalled.size)
            assertArrayEquals(mockedRequestApduB, sendApduCalled[2])

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
    fun `GIVEN the device connection state machine in SendingApdu state WHEN the connection is closed THEN the machine terminates and the APDU request fails`() =
        runTest {
            var terminated = false
            var sendApduResult: SendApduResult? = null
            var error: Throwable? = null

            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { _, _ -> },
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
                resultCallback = { result -> sendApduResult = result },
                abortTimeoutDuration = Duration.INFINITE
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
    fun `GIVEN the device connection state machine in SendingApdu state WHEN the device disconnects THEN the APDU fails and the machine moves to WaitingForReconnection`() =
        runTest {
            var sendApduResult: SendApduResult? = null
            var terminated = false
            var error: Throwable? = null

            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { _,_ -> },
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
                resultCallback = { result -> sendApduResult = result },
                abortTimeoutDuration = Duration.INFINITE
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
    fun `GIVEN the device connection state machine in SendingApdu state WHEN an APDU request is received THEN it returns a DeviceBusy failure`() =
        runTest {
            var firstSendApduResult: SendApduResult? = null
            var secondSendApduResult: SendApduResult? = null
            var terminated = false
            var error: Throwable? = null

            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { _,_ -> },
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
                resultCallback = { firstSendApduResult = it },
                abortTimeoutDuration = Duration.INFINITE
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
                resultCallback = { secondSendApduResult = it },
                abortTimeoutDuration = Duration.INFINITE
            ))

            assertEquals(
                SendApduResult.Failure(SendApduFailureReason.DeviceBusy),
                secondSendApduResult
            )

            // Simulate response to first request
            val mockedSuccessApduResult = SendApduResult.Success(mockedResultApduSuccessA)
            stateMachine.handleApduResult(mockedSuccessApduResult)

            // First request should have succeeded
            assertEquals(mockedSuccessApduResult, firstSendApduResult)

            assertFalse(terminated)
            assertNull(error)
        }

    @Test
    fun `GIVEN the device connection state machine in WaitingForReconnection state WHEN the device reconnects THEN it transitions to Connected state`() =
        runTest {
            var terminated = false

            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { _,_ -> },
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

    @Test
    fun `GIVEN the device connection state machine in WaitingForReconnection state WHEN the reconnection times out THEN the machine terminates`() =
        runTest {
            var terminated = false

            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { _,_ -> },
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
    fun `GIVEN the device connection state machine in WaitingForReconnection state WHEN an APDU is queued THEN on device connection the APDU is sent`() =
        runTest {
            var sendApduCalled: ByteArray? = null
            var sendApduResult: SendApduResult? = null
            var terminated = false
            var error: Throwable? = null

            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { apdu, _ -> sendApduCalled = apdu },
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
                resultCallback = { sendApduResult = it },
                abortTimeoutDuration = Duration.INFINITE
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
    fun `GIVEN the device connection state machine with a queued APDU WHEN the connection is closed THEN the machine terminates and the APDU request fails`() =
        runTest {
            var terminated = false
            var sendApduResult: SendApduResult? = null
            var error: Throwable? = null

            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { _,_ -> },
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
                resultCallback = { result -> sendApduResult = result },
                abortTimeoutDuration = Duration.INFINITE
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

    @Test
    fun `GIVEN the device connection state machine with a queued APDU WHEN the reconnection times out THEN the machine terminates and the APDU request fails`() =
        runTest {
            var sendApduResult: SendApduResult? = null
            var terminated = false
            var error: Throwable? = null

            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { _,_ -> },
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
                resultCallback = { result -> sendApduResult = result },
                abortTimeoutDuration = Duration.INFINITE
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
    fun `GIVEN the device connection state machine in queued state WHEN a new APDU request is received THEN it returns a DeviceBusy failure`() =
        runTest {
            var firstSendApduResult: SendApduResult? = null
            var secondSendApduResult: SendApduResult? = null
            var terminated = false
            var error: Throwable? = null

            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { _,_ -> },
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
                resultCallback = { firstSendApduResult = it },
                abortTimeoutDuration = Duration.INFINITE
            ))

            // Second APDU sending request
            stateMachine.requestSendApdu(DeviceConnectionStateMachine.SendApduRequestContent(
                apdu = byteArrayOf(0x0B),
                triggersDisconnection = false,
                resultCallback = { secondSendApduResult = it },
                abortTimeoutDuration = Duration.INFINITE
            ))

            // Second request should immediately return busy.
            assertEquals(
                SendApduResult.Failure(SendApduFailureReason.DeviceBusy),
                secondSendApduResult
            )

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
    fun `GIVEN the device connection state machine in Terminated state WHEN any event occurs THEN it triggers onError`() =
        runTest {
            var errorCalled: Throwable? = null

            val stateMachine = DeviceConnectionStateMachine(
                sendApduFn = { _,_ -> },
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
        val mockedRequestApduA: ByteArray = "1234".fromHexStringToBytesOrThrow()
        val mockedRequestApduB: ByteArray = "5678".fromHexStringToBytesOrThrow()
        val mockedGetAppAndVersionSuccessfulResponse: ByteArray = "12349000".fromHexStringToBytesOrThrow()
        val mockedGetAppAndVersionBusyResponse: ByteArray = "12346601".fromHexStringToBytesOrThrow()
        val mockedResultApduSuccessA: ByteArray = "56789000".fromHexStringToBytesOrThrow()
        val mockedResultApduSuccessB: ByteArray = "abcd9000".fromHexStringToBytesOrThrow()
    }
}