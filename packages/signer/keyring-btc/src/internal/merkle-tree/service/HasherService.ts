export interface HasherService {
  hash: (buffer: Uint8Array) => Uint8Array;
}
