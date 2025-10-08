package com.ledger.devicesdk.shared.api.device

public sealed class LedgerDevice(
        public val name: String,
        public val usbInfo: UsbInfo,
        public val bleInformation: BleInformation? = null,
) {
    public data object Apex :
            LedgerDevice(
                name = "Ledger Apex",
                usbInfo = UsbInfo(LEDGER_USB_VENDOR_ID, "0x80", "0x0008"),
                bleInformation =
                    BleInformation(
                        serviceUuid = "13d63400-2c97-6004-0000-4c6564676572",
                        notifyCharacteristicUuid =
                            "13d63400-2c97-6004-0001-4c6564676572",
                        writeWithResponseCharacteristicUuid =
                            "13d63400-2c97-6004-0002-4c6564676572",
                        writeWithoutResponseCharacteristicUuid =
                            "13d63400-2c97-6004-0003-4c6564676572",
                    ),
            )
    public data object Flex :
            LedgerDevice(
                    name = "Ledger Flex",
                    usbInfo = UsbInfo(LEDGER_USB_VENDOR_ID, "0x70", "0x0007"),
                    bleInformation =
                            BleInformation(
                                    serviceUuid = "13d63400-2c97-3004-0000-4c6564676572",
                                    notifyCharacteristicUuid =
                                            "13d63400-2c97-3004-0001-4c6564676572",
                                    writeWithResponseCharacteristicUuid =
                                            "13d63400-2c97-3004-0002-4c6564676572",
                                    writeWithoutResponseCharacteristicUuid =
                                            "13d63400-2c97-3004-0003-4c6564676572",
                            ),
            )

    public data object Stax :
            LedgerDevice(
                    name = "Ledger Stax",
                    usbInfo = UsbInfo(LEDGER_USB_VENDOR_ID, "0x60", "0x0006"),
                    bleInformation =
                            BleInformation(
                                    serviceUuid = "13d63400-2c97-6004-0000-4c6564676572",
                                    notifyCharacteristicUuid =
                                            "13d63400-2c97-6004-0001-4c6564676572",
                                    writeWithResponseCharacteristicUuid =
                                            "13d63400-2c97-6004-0002-4c6564676572",
                                    writeWithoutResponseCharacteristicUuid =
                                            "13d63400-2c97-6004-0003-4c6564676572",
                            ),
            )

    public data object NanoX :
            LedgerDevice(
                    name = "Nano X",
                    usbInfo = UsbInfo(LEDGER_USB_VENDOR_ID, "0x40", "0x0004"),
                    bleInformation =
                            BleInformation(
                                    serviceUuid = "13d63400-2c97-0004-0000-4c6564676572",
                                    notifyCharacteristicUuid =
                                            "13d63400-2c97-0004-0001-4c6564676572",
                                    writeWithResponseCharacteristicUuid =
                                            "13d63400-2c97-0004-0002-4c6564676572",
                                    writeWithoutResponseCharacteristicUuid =
                                            "13d63400-2c97-0004-0003-4c6564676572",
                            ),
            )

    public data object NanoSPlus :
            LedgerDevice(
                    name = "Nano S Plus",
                    usbInfo = UsbInfo(LEDGER_USB_VENDOR_ID, "0x50", "0x0005"),
                    bleInformation = null,
            )

    public data object NanoS :
            LedgerDevice(
                    name = "Nano S",
                    usbInfo = UsbInfo(LEDGER_USB_VENDOR_ID, "0x10", "0x0001"),
                    bleInformation = null,
            )

    public companion object {
        public const val LEDGER_USB_VENDOR_ID: String = "0x2c97"

        // Cannot use reflexion here to get all subclasses as it depends of the JVM
        private val subclasses = buildList {
            add(Flex)
            add(Stax)
            add(NanoX)
            add(NanoSPlus)
            add(NanoS)
            add(Apex)
        }

        public fun getAllDevices(): List<LedgerDevice> {
            return subclasses
        }

        public fun getAllDevicesWithBluetooth(): List<LedgerDevice> =
                getAllDevices().filter { it.bleInformation != null }
    }
}
