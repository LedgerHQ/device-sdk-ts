import { type SpeculosDeviceButtonsKeys } from "./E2eHttpSpeculosDatasource";

export interface E2eSpeculosDatasource {
  postAdpu(apdu: string): Promise<string>;
  pressButton(but: SpeculosDeviceButtonsKeys): Promise<void>;
  openEventStream(
    onEvent: (json: Record<string, unknown>) => void,
    onClose?: () => void,
  ): Promise<NodeJS.ReadableStream>;
}
