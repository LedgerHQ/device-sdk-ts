export const APP_NAME = "InternetComputer";

// Chunk-sequence P1 values shared by the ICP chunked-sign commands
// (INS 0x02 / 0x03): the first packet carries the derivation path, then the
// payload is split across ADD packets and closed by a LAST packet.
export const P1_INIT = 0x00;
export const P1_ADD = 0x01;
export const P1_LAST = 0x02;

export enum SignPhase {
  INIT = "init",
  ADD = "add",
  LAST = "last",
}
