export interface SpeculosDatasource {
  postApdu(apdu: string): Promise<string>;
  isServerAvailable(): Promise<boolean>;
  openEventStream(
    onEvent: (json: Record<string, unknown>) => void,
    onClose?: () => void,
  ): Promise<ReadableStream<Uint8Array> | { cancel: () => void }>;
}
