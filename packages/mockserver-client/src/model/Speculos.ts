import { Codec, string } from "purify-ts";

/**
 * The live Speculos emulator instance backing a device, returned by
 * `GET /devices/:id/speculos`. Control calls are proxied through
 * `/devices/:id/speculos/*`.
 */
export interface SpeculosInstance {
  /** Speculinho run id owning the emulator pod. */
  readonly run_id: string;
  /** Per-pod emulator URL (reachable from the mock server). */
  readonly speculos_url: string;
  /** Device model (e.g. "nanoX", "stax", "flex"). */
  readonly model: string;
}

export const speculosInstanceCodec = Codec.interface({
  run_id: string,
  speculos_url: string,
  model: string,
});
