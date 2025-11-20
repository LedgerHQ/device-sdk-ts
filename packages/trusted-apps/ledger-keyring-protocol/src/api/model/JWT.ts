export type JWT = {
  access_token: string;
  permissions: {
    [LedgerKeyRingProtocolId: string]: {
      [path: string]: string[];
    };
  };
};
