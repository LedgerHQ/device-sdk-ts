import { type JsonTransactionFormat } from "@ledgerhq/device-signer-kit-cosmos";

export const dummySignDocJson: JsonTransactionFormat = {
  account_number: "0",
  chain_id: "test-chain-1",
  fee: {
    amount: [
      {
        amount: "5",
        denom: "photon",
      },
    ],
    gas: "10000",
  },
  memo: "testmemo",
  msgs: [
    {
      inputs: [
        {
          address: "cosmosaccaddr1d9h8qat5e4ehc5",
          coins: [
            {
              amount: "10",
              denom: "atom",
            },
          ],
        },
      ],
      outputs: [
        {
          address: "cosmosaccaddr1da6hgur4wse3jx32",
          coins: [
            {
              amount: "10",
              denom: "atom",
            },
          ],
        },
      ],
    },
  ],
  sequence: "1",
};
