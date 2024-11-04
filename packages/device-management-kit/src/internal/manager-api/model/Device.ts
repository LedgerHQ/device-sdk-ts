export type DeviceVersion = {
  id: number;
  name: string;
  display_name: string;
  target_id: string;
  description: string;
  device: number;
  providers: Array<number>;
  mcu_versions: Array<number>;
  se_firmware_final_versions: Array<number>;
  osu_versions: Array<number>;
  application_versions: Array<number>;
  date_creation: string;
  date_last_modified: string;
};
