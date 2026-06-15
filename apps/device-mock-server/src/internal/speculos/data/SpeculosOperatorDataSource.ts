import { type EitherAsync } from "purify-ts";

import {
  type AcquireRequest,
  type SpeculosError,
  type SpeculosProxyRequest,
  type SpeculosProxyResponse,
} from "@internal/speculos/model/SpeculosModels";

/**
 * Port for the Speculinho operator HTTP API (acquire / status / release) plus
 * forwarding APDUs to the per-pod Speculos emulator.
 */
export interface SpeculosOperatorDataSource {
  /** Create a Speculos instance; resolves the (echoed) `run_id`. */
  acquire(
    req: AcquireRequest,
    runId: string,
  ): EitherAsync<SpeculosError, string>;
  /** Poll until ready; resolves the emulator URL, or fails on failed/timeout. */
  waitUntilReady(runId: string): EitherAsync<SpeculosError, string>;
  /** Destroy a Speculos instance (best-effort). */
  release(runId: string): EitherAsync<SpeculosError, void>;
  /** Forward a raw APDU (hex) to a ready emulator; resolves its hex response. */
  forwardApdu(
    speculosUrl: string,
    apduHex: string,
  ): EitherAsync<SpeculosError, string>;
  /** Transparent passthrough of an arbitrary request to a ready emulator. */
  proxyRequest(
    speculosUrl: string,
    request: SpeculosProxyRequest,
  ): EitherAsync<SpeculosError, SpeculosProxyResponse>;
}
