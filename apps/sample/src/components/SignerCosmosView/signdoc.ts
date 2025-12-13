import {
  createSignDoc,
  type StdSignDoc,
} from "@ledgerhq/device-signer-kit-cosmos";

const signDocJson: StdSignDoc = {
  chain_id: "cosmoshub-4",
  account_number: "1",
  sequence: "0",
  fee: {
    amount: [
      {
        denom: "uatom",
        amount: "2000", // 0.002 ATOM as fee (example)
      },
    ],
    gas: "80000",
  },
  memo: "dummy 0.1 atom transfer on cosmoshub",
  msgs: [
    {
      type: "cosmos-sdk/MsgSend",
      value: {
        from_address: "cosmos19r4qdewyjnzp50usalc8sq96c6h5c3pe6v309r",
        to_address: "cosmos19r4qdewyjnzp50usalc8sq96c6h5c3pe6v309r",
        amount: [
          {
            denom: "uatom",
            amount: "100000", // 0.1 ATOM in micro units
          },
        ],
      },
    },
  ],
};
export const dummySignDoc = createSignDoc(signDocJson);
