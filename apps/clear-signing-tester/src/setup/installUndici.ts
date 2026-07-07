import { install } from "undici";

/**
 * Replace Node's built-in `fetch` stack with the userland undici implementation.
 *
 * Node 24 bundles undici 7.x, whose HTTP/1 parser throws an *uncatchable*
 * `AssertionError` from the socket `'end'` handler when the parser is paused
 * under response-body backpressure and the peer closes the connection
 * (see https://github.com/nodejs/undici/issues/5360). This crashes the whole
 * CLI process mid-run instead of surfacing a catchable error.
 *
 * The fix ships in undici >= 8.4.1, so we install the patched userland version
 * over the global `fetch`/`Headers`/`Request`/`Response`. Importing this module
 * for its side effect (as early as possible) ensures every HTTP call — the
 * Solana RPC adapter, the context module, the metadata service, etc. — routes
 * through the patched client.
 */
install();
