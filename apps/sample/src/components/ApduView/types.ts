import { type ApduHistoryItem } from "./ApduResponseView";

export type ModeProps = {
  sendApdu: (apdu: Uint8Array) => Promise<ApduHistoryItem>;
  disabled?: boolean; // true when no session selected
};
