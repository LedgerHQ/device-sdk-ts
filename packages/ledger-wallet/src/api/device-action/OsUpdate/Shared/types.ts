export type McuFirmware = {
  id: number;
  name: string;
  fromBootloaderVersion: string;
  providers: number[];
};

export type BaseFirmware = {
  id: number;
  perso: string;
  hash: string | null;
};

export type OsuFirmware = BaseFirmware & {
  notes: string | null;
  firmware: string;
  firmwareKey: string;
  nextFinalFirmware: number;
};

export type FinalFirmware = BaseFirmware & {
  version: string;
  bytes: number | null;
  firmware: string | null;
  firmwareKey: string | null;
  mcuVersions: number[];
};

export type OsUpdate = {
  osuFirmware: OsuFirmware;
  finalFirmware: FinalFirmware;
  shouldFlashMcu: boolean;
};

export type DeviceInfos = {
  targetId: number;
  seVersion: string;
  mcuSephVersion: string;
  isOsu: boolean;
};
