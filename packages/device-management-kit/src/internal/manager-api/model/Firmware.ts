export type OsuFirmware = {
  id: number;
  perso: string;
  firmware: string;
  firmwareKey: string;
  hash: string | null;
  nextFinalFirmware: number;
};

export type FinalFirmware = {
  id: number;
  version: string;
  perso: string;
  firmware: string | null;
  firmwareKey: string | null;
  hash: string | null;
  bytes: number | null;
  mcuVersions: number[];
};

export type McuFirmware = {
  id: number;
  name: string;
};
