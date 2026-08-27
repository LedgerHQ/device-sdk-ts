/**
 * src/components/DeviceScreen/deviceModel.ts
 *
 * Per-model facts the device screen needs. Screen dimensions are not among
 * them: every frame is a PNG that carries its own.
 */
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Icons } from "@ledgerhq/react-ui";

export interface DeviceScreenModel {
  readonly label: string;
  readonly Icon: typeof Icons.Nano;
  /** How the device is driven: a touchscreen, or physical buttons. */
  readonly touch: boolean;
  readonly buttons: boolean;
}

const nano = (label: string): DeviceScreenModel => ({
  label,
  Icon: Icons.Nano,
  touch: false,
  buttons: true,
});

export const DEVICE_SCREEN: Record<DeviceModelId, DeviceScreenModel> = {
  [DeviceModelId.NANO_S]: nano("Nano S"),
  [DeviceModelId.NANO_SP]: nano("Nano S Plus"),
  [DeviceModelId.NANO_X]: nano("Nano X"),
  [DeviceModelId.STAX]: {
    label: "Stax",
    Icon: Icons.Stax,
    touch: true,
    buttons: false,
  },
  [DeviceModelId.FLEX]: {
    label: "Flex",
    Icon: Icons.Flex,
    touch: true,
    buttons: false,
  },
  [DeviceModelId.APEX]: {
    label: "Apex",
    Icon: Icons.Apex,
    touch: true,
    buttons: false,
  },
};
