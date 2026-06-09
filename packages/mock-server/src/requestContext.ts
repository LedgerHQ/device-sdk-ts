import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request context propagated through async continuations so the logger can
 * tag every line with the originating session, without threading the token
 * through every call site.
 */
interface RequestContext {
  readonly sessionToken?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(
  context: RequestContext,
  fn: () => T,
): T => storage.run(context, fn);

export const getSessionToken = (): string | undefined =>
  storage.getStore()?.sessionToken;
