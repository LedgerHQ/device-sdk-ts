import { SignDoc } from "@ledgerhq/device-signer-kit-cosmos";

const signDocJson = {
  chain_id: "noble-1",
  account_number: "1",
  sequence: "0",
  fee: {
    amount: [
      {
        denom: "uusdc",
        amount: "2000", // 0.002 USDC as fee (example)
      },
    ],
    gas: "80000",
  },
  memo: "dummy 0.1 uusdc transfer on boble",
  msgs: [
    {
      type: "cosmos-sdk/MsgSend",
      value: {
        from_address: "noble19r4qdewyjnzp50usalc8sq96c6h5c3pe6v309r",
        to_address: "noble19r4qdewyjnzp50usalc8sq96c6h5c3pe6v309r",
        amount: [
          {
            denom: "uusdc",
            amount: "100000", // 0.1 USDC in micro units
          },
        ],
      },
    },
  ],
};

export const dummySignDoc = new SignDoc(signDocJson);
