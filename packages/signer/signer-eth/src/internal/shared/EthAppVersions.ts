/**
 * Minimum Ethereum app version that supports gated signing (PROXY_INFO + GATED_SIGNING).
 * Older app versions do not recognize these contexts and signing fails if they are sent.
 */
export const MIN_ETH_APP_VERSION_FOR_GATED_SIGNING = "1.22.0";

/**
 * Version threshold for generic parser (ERC-7730) support. The app must be strictly newer
 * than this version (withMinVersionExclusive), i.e. 1.15.0 or above.
 */
export const MIN_ETH_APP_VERSION_FOR_GENERIC_PARSER = "1.14.0";

/**
 * Version threshold for Web3 checks support on transaction signing. The app must be strictly
 * newer than this version (withMinVersionExclusive), i.e. 1.16.0 or above.
 */
export const MIN_ETH_APP_VERSION_FOR_WEB3_CHECKS = "1.15.0";
