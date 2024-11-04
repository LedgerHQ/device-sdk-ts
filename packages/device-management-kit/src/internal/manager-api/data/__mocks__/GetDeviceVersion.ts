import { type DeviceVersion } from "@internal/manager-api/model/Device";

export const deviceVersionMockBuilder = (
  props: Partial<{ name: string; target_id: string; id: number }> = {},
): DeviceVersion => ({
  id: 17,
  name: "Fatstacks",
  display_name: "Fatstacks",
  target_id: "857735172",
  description: "",
  device: 6,
  providers: [15, 6, 12],
  mcu_versions: [126, 91, 103],
  se_firmware_final_versions: [270, 165],
  osu_versions: [215, 496, 228],
  application_versions: [43164, 34957],
  date_creation: "2022-03-21T17:32:33.225732Z",
  date_last_modified: "2024-10-23T12:55:27.023755Z",
  ...props,
});
