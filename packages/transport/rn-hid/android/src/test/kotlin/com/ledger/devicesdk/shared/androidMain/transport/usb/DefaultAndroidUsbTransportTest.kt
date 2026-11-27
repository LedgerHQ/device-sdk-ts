package com.ledger.devicesdk.shared.androidMain.transport.usb

import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import com.ledger.devicesdk.shared.androidMain.transport.usb.model.UsbState
import com.ledger.devicesdk.shared.androidMain.transport.usb.utils.toLedgerUsbDevice
import com.ledger.devicesdk.shared.api.discovery.DiscoveryDevice
import com.ledger.devicesdk.shared.internal.connection.InternalConnectionResult
import com.ledger.devicesdk.shared.internal.event.SdkEventDispatcher
import com.ledger.devicesdk.shared.internal.transport.TransportEvent
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.seconds

/**
 * Android gives a USB device a new device number when it re-enumerates, for
 * example when an app change on the device triggers a disconnection/reconnection.
 * These tests check that discovery and connect give the device the same id,
 * before and after a re-enumeration.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class DefaultAndroidUsbTransportTest {
    private val androidDevices = mutableMapOf<String, UsbDevice>()

    private val usbManager = mockk<UsbManager> {
        every { deviceList } answers { HashMap(androidDevices) }
        every { hasPermission(any<UsbDevice>()) } returns true
        every { openDevice(any()) } answers { mockk(relaxed = true) }
    }

    private val eventDispatcher = mockk<SdkEventDispatcher>(relaxed = true)

    private val beforeAppChange = nanoX(number = 1005)
    private val afterAppChange = nanoX(number = 1006)

    @Test
    fun `GIVEN a device without connection WHEN discovered THEN its id is usb_number`() = runTest {
        val transport = createTransport()
        plugIn(beforeAppChange)

        assertEquals("usb_1005", scan(transport).uid)
    }

    @Test
    fun `GIVEN a discovered device WHEN connected THEN the session id is the discovered id`() = runTest {
        val transport = createTransport()
        plugIn(beforeAppChange)

        assertEquals("usb_1005", connect(transport, scan(transport)).sessionId)
    }

    @Test
    fun `GIVEN a connected device WHEN it re-enumerates THEN discovery gives the session id`() = runTest {
        val transport = createTransport()
        plugIn(beforeAppChange)
        connect(transport, scan(transport))

        reEnumerate(transport, from = beforeAppChange, to = afterAppChange)

        assertEquals("usb_1005", scan(transport).uid)
    }

    @Test
    fun `GIVEN a device that re-enumerates WHEN discovered before the reconnection ends THEN discovery gives the session id`() = runTest {
        val transport = createTransport()
        plugIn(beforeAppChange)
        connect(transport, scan(transport))

        startReEnumeration(transport, from = beforeAppChange, to = afterAppChange)

        assertEquals("usb_1005", scan(transport).uid)
    }

    @Test
    fun `GIVEN a device that re-enumerates WHEN connected before the reconnection ends THEN the waiting connection is used`() = runTest {
        val transport = createTransport()
        plugIn(beforeAppChange)
        connect(transport, scan(transport))
        startReEnumeration(transport, from = beforeAppChange, to = afterAppChange)

        val result = connect(transport, scan(transport))

        assertEquals("usb_1005", result.sessionId)
        // One opening for the first connection, one for the reconnection: connect opens no other.
        verify(exactly = 2) { usbManager.openDevice(any()) }
    }

    @Test
    fun `GIVEN a re-enumerated device WHEN connected THEN the open connection is used`() = runTest {
        val transport = createTransport()
        plugIn(beforeAppChange)
        connect(transport, scan(transport))
        reEnumerate(transport, from = beforeAppChange, to = afterAppChange)

        val result = connect(transport, scan(transport))

        assertEquals("usb_1005", result.sessionId)
        // One opening for the first connection, one for the reconnection.
        verify(exactly = 2) { usbManager.openDevice(any()) }
    }

    @Test
    fun `GIVEN a re-enumerated device WHEN disconnected THEN its session ends`() = runTest {
        val transport = createTransport()
        plugIn(beforeAppChange)
        connect(transport, scan(transport))
        reEnumerate(transport, from = beforeAppChange, to = afterAppChange)

        transport.disconnect("usb_1005")
        runCurrent()

        verify(exactly = 1) {
            eventDispatcher.dispatch(TransportEvent.DeviceConnectionLost("usb_1005"))
        }
        assertEquals("usb_1006", scan(transport).uid)
    }

    private fun TestScope.createTransport() = DefaultAndroidUsbTransport(
        application = mockk(relaxed = true),
        usbManager = usbManager,
        permissionRequester = { _, _, _ -> },
        eventDispatcher = eventDispatcher,
        loggerService = { },
        scanDelay = 500.milliseconds,
        coroutineDispatcher = StandardTestDispatcher(testScheduler),
    )

    private suspend fun TestScope.scan(transport: DefaultAndroidUsbTransport): DiscoveryDevice {
        val devices = transport.startScan().first { it.isNotEmpty() }
        transport.stopScan()
        return devices.single()
    }

    private suspend fun connect(
        transport: DefaultAndroidUsbTransport,
        device: DiscoveryDevice,
    ): InternalConnectionResult.Connected =
        assertIs<InternalConnectionResult.Connected>(transport.connect(device))

    /** Discovery reads the device list of Android, so plugging in a device needs no event. */
    private fun plugIn(device: UsbDevice) {
        androidDevices[device.deviceName] = device
    }

    /**
     * What Android does when an app change on the device triggers a
     * disconnection/reconnection: it detaches the device, then attaches it
     * again with a new device number.
     */
    private fun TestScope.reEnumerate(
        transport: DefaultAndroidUsbTransport,
        from: UsbDevice,
        to: UsbDevice,
    ) {
        startReEnumeration(transport, from, to)
        // The transport gives the new device to the waiting connection after
        // 200 ms, and would end the session after 5 s.
        advanceTimeBy(1.seconds)
        runCurrent()
    }

    /**
     * The first part of [reEnumerate]: Android has attached the new device, and
     * the transport has not given it to the waiting connection yet.
     */
    private fun TestScope.startReEnumeration(
        transport: DefaultAndroidUsbTransport,
        from: UsbDevice,
        to: UsbDevice,
    ) {
        androidDevices.remove(from.deviceName)
        transport.updateUsbState(UsbState.Detached(from.toLedgerUsbDevice()!!))
        // The open connection now waits for its device.
        runCurrent()

        androidDevices[to.deviceName] = to
        transport.updateUsbState(UsbState.Attached(to.toLedgerUsbDevice()!!))
        runCurrent()
    }

    private fun nanoX(number: Int): UsbDevice {
        val outEndpoint = mockk<UsbEndpoint> { every { direction } returns UsbConstants.USB_DIR_OUT }
        val inEndpoint = mockk<UsbEndpoint> { every { direction } returns UsbConstants.USB_DIR_IN }
        val usbInterface = mockk<UsbInterface> {
            every { endpointCount } returns 2
            every { getEndpoint(0) } returns outEndpoint
            every { getEndpoint(1) } returns inEndpoint
        }
        return mockk {
            every { deviceId } returns number
            every { deviceName } returns "/dev/bus/usb/001/$number"
            every { vendorId } returns 0x2c97
            every { productId } returns 0x4011 // Nano X
            every { getInterface(0) } returns usbInterface
        }
    }
}
