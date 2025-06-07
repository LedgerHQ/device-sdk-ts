package com.ledger.devicesdk.shared.androidMainInternal.transport.deviceconnection

import com.ledger.devicesdk.shared.api.apdu.SendApduResult
import com.ledger.devicesdk.shared.internal.service.logger.LogInfo
import com.ledger.devicesdk.shared.internal.service.logger.LoggerService
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
import kotlin.time.Duration.Companion.seconds
import kotlin.test.Test
import org.junit.Assert.*
import kotlin.time.Duration
import kotlin.time.Duration.Companion.milliseconds

/**
 * Those tests focus mainly on calling all public methods, and ensuring that the correct apduSender
 * is used after reconnections.
 * For full coverage of the possible scenarios, check the unit tests of DeviceConnectionStateMachine.
 */
class DeviceConnectionTest {
    @Test
    fun `GIVEN a device connection with an APDU sender WHEN requestSendApdu is called THEN the apduSender is used and the result is obtained`() = runTest {
        val apduSender = MockedApduSender()

        val deviceConnection = DeviceConnection(
            sessionId = "mockId",
            deviceApduSender = apduSender,
            onTerminated = { },
            isFatalSendApduFailure = { false },
            reconnectionTimeoutDuration = 5.seconds,
            loggerService = FakeLoggerService(),
            coroutineDispatcher = StandardTestDispatcher(testScheduler),
        )

        // Request sending an APDU
        deviceConnection.requestSendApdu(apdu=mockedApdu, triggersDisconnection = false, abortTimeoutDuration = Duration.INFINITE)

        // Send APDU should have been called once with the correct apdu
        assertEquals(1, apduSender.sendCalls.size)
        assertArrayEquals(mockedApdu, apduSender.sendCalls[0])
    }

    @Test
    fun `GIVEN a device connection with an initial APDU sender and an APDU that triggers disconnection WHEN requestSendApdu is called and a reconnection occurs THEN the second apduSender is used and the result is obtained`() =
        runTest {
            apdusTriggeringDisconnection.forEach { apduTriggeringDisconnection ->
                val apduSender1 = MockedApduSender()
                apduSender1.nextResult = mockedSuccessApduResult

                val deviceConnection = DeviceConnection(
                    sessionId = "mockId",
                    deviceApduSender = apduSender1,
                    onTerminated = { },
                    isFatalSendApduFailure = { false },
                    reconnectionTimeoutDuration = 5.seconds,
                    loggerService = FakeLoggerService(),
                    coroutineDispatcher = StandardTestDispatcher(testScheduler),
                )

                // Request sending an apdu
                val result1 = deviceConnection.requestSendApdu(apdu=apduTriggeringDisconnection, triggersDisconnection = false, abortTimeoutDuration = Duration.INFINITE)

                // apduSender1.sendApdu should have been called once with the correct apdu
                assertEquals(1, apduSender1.sendCalls.size)
                assertArrayEquals(apduTriggeringDisconnection, apduSender1.sendCalls[0])

                // The result should have been obtained
                assertEquals(mockedSuccessApduResult, result1)

                // Request sending a second apdu
                val result2 = async {
                    deviceConnection.requestSendApdu(apdu = mockedApdu, triggersDisconnection = false, abortTimeoutDuration = Duration.INFINITE)
                }

                // apduSender1.sendApdu shouldn't have been called again
                assertEquals(1, apduSender1.sendCalls.size)

                // Simulate reconnection
                val apduSender2 = MockedApduSender()
                apduSender2.nextResult = mockedSuccessApduResult
                deviceConnection.handleDeviceConnected(apduSender2)

                // The result should have been obtained
                assertEquals(mockedSuccessApduResult, result2.await())

                // apduSender2.sendApdu should have been called once with the correct apdu
                assertEquals(1, apduSender2.sendCalls.size)
                assertArrayEquals(mockedApdu, apduSender2.sendCalls[0])
            }
        }

    @OptIn(ExperimentalCoroutinesApi::class)
    @Test
    fun `GIVEN a device connection WHEN handleDeviceDisconnected is called and the timeout elapses THEN onTerminated is triggered`() =
        runTest {
            var terminated = false
            val apduSender = MockedApduSender()

            val deviceConnection = DeviceConnection(
                sessionId = "mockId",
                deviceApduSender = apduSender,
                onTerminated = {
                    terminated = true
                },
                isFatalSendApduFailure = { false },
                reconnectionTimeoutDuration = 5.seconds,
                loggerService = FakeLoggerService(),
                coroutineDispatcher = StandardTestDispatcher(testScheduler),
            )

            // Simulate disconnection
            deviceConnection.handleDeviceDisconnected()

            // Timeout
            advanceTimeBy(5.seconds)
            assertFalse(terminated)
            advanceTimeBy(1.milliseconds)
            assertTrue(terminated)
        }

    @Test
    fun `GIVEN a disconnected device connection WHEN a device gets reconnected and an APDU is requested THEN the correct apduSender is used and the result is obtained`() =
        runTest {
            val apduSender1 = MockedApduSender()

            val deviceConnection = DeviceConnection(
                sessionId = "mockId",
                deviceApduSender = apduSender1,
                onTerminated = { },
                isFatalSendApduFailure = { false },
                reconnectionTimeoutDuration = 5.seconds,
                loggerService = FakeLoggerService(),
                coroutineDispatcher = StandardTestDispatcher(testScheduler),
            )

            // Simulate disconnection
            deviceConnection.handleDeviceDisconnected()

            // Request sending an APDU
            val result = async {
                deviceConnection.requestSendApdu(apdu = mockedApdu, triggersDisconnection = false, abortTimeoutDuration = Duration.INFINITE)
            }

            // Simulate reconnection
            val apduSender2 = MockedApduSender()
            deviceConnection.handleDeviceConnected(apduSender2)

            // The result should have been obtained
            assertEquals(mockedSuccessApduResult, result.await())

            // apduSender1.sendApdu should not have been called
            assertEquals(0, apduSender1.sendCalls.size)

            // apduSender2.sendApdu should have been called once with the correct apdu
            assertEquals(1, apduSender2.sendCalls.size)
            assertArrayEquals(mockedApdu, apduSender2.sendCalls[0])
        }

    @Test
    fun `GIVEN a device connection WHEN requestCloseConnection is called THEN onTerminated is triggered`() = runTest {
        var terminated = false

        val deviceConnection = DeviceConnection(
            sessionId = "mockId",
            deviceApduSender = MockedApduSender(),
            onTerminated = {
                terminated = true
            },
            isFatalSendApduFailure = { false },
            reconnectionTimeoutDuration = 5.seconds,
            loggerService = FakeLoggerService(),
            coroutineDispatcher = StandardTestDispatcher(testScheduler),
        )

        // Request closing connection
        deviceConnection.requestCloseConnection()

        // onTerminated should have been called
        assertTrue(terminated)
    }

    // Helpers
    companion object {

        val mockedApdu: ByteArray = byteArrayOf(0x01, 0x02)

        val apdusTriggeringDisconnection: List<ByteArray> = listOf(
            byteArrayOf(0xe0.toByte(), 0xd8.toByte(), 0x01), // Open app
            byteArrayOf(0xe0.toByte(), 0xd8.toByte(), 0x01) // Close app
        )

        val mockedSuccessApduResult =
            SendApduResult.Success(byteArrayOf(0x05, 0x06, 0x90.toByte(), 0x00))

        class MockedApduSender() : DeviceApduSender<String> {
            // can be set from the outside for easy mocking
            var nextResult: SendApduResult = mockedSuccessApduResult

            private val _sendCalls: MutableList<ByteArray> = mutableListOf()
            // to easily check from the outside the apdus sent
            val sendCalls: MutableList<ByteArray>
                get() = _sendCalls

            override suspend fun send(
                apdu: ByteArray,
                abortTimeoutDuration: Duration
            ): SendApduResult {
                _sendCalls += apdu
                return nextResult
            }

            override val dependencies: String
                get() = ""
        }

        internal class FakeLoggerService : LoggerService {
            override fun log(info: LogInfo) {}
        }
    }
}