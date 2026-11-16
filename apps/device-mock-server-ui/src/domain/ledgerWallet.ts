/** Opens Ledger Wallet and points its mock server transport at this session. */
export const ledgerWalletDeepLink = (url: string, token: string): string =>
  `ledgerlive://mockserver/config?url=${encodeURIComponent(
    url,
  )}&token=${encodeURIComponent(token)}`;
