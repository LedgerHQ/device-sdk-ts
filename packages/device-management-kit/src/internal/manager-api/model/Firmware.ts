type BaseFirmware = {
  id: number;
  name: string;
  description: string | null | undefined;
  display_name: string | null | undefined;
  notes: string | null | undefined;
  perso: string;
  firmware: string;
  firmware_key: string;
  hash: string;
  date_creation: string;
  date_last_modified: string;
  device_versions: Array<number>;
  providers: Array<number>;
};

type OsuFirmware = BaseFirmware & {
  next_se_firmware_final_version: number;
  previous_se_firmware_final_version: Array<number>;
};

export type FirmwareUpdateContext = {
  osu: OsuFirmware;
  final: FinalFirmware;
  shouldFlashMCU: boolean;
};

export type FinalFirmware = BaseFirmware & {
  version: string;
  se_firmware: number;
  osu_versions: Array<OsuFirmware>;
  mcu_versions: Array<number>;
  application_versions: Array<number>;
  bytes?: number;
  updateAvailable?: FirmwareUpdateContext | null;
};
