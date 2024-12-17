import { base64, hex } from "@scure/base";
import * as btc from "micro-btc-signer";

const bitcoinTestnet = {
  bech32: "tb",
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
};

// You can use any public Bitcoin API to retrieve unspent outputs
const output = {
  tx_hash: "f39d37ec885de70c598648a2f80f103e1cdf34f7021ddfcb22216b7076169226",
  block_height: 780179,
  tx_input_n: -1,
  tx_output_n: 1,
  value: 300000,
  ref_balance: 22681,
  spent: false,
  confirmations: 123,
  confirmed: "2023-03-10T10:02:21Z",
  double_spend: false,
};

const publicKey = hex.decode(
  "02818b7ff740a40f311d002123087053d5d9e0e1546674aedb10e15a5b57fd3985",
);

const p2wpkh = btc.p2wpkh(publicKey, bitcoinTestnet);
const p2sh = btc.p2sh(p2wpkh, bitcoinTestnet);

const tx = new btc.Transaction();

tx.addInput({
  txid: output.tx_hash,
  index: output.tx_output_n,
  witnessUtxo: {
    script: p2sh.script,
    amount: BigInt(output.value),
  },
  redeemScript: p2sh.redeemScript,
});

// You can add more inputs here as necessary

// Add outputs
const recipient =
  "tb1pzwa68q3udj0f7g5xtdakgecvf45dvssu66ry7y3at22w7vus20vq3sgw62";
const changeAddress = "2NBfRKCUpafbatj5gV9T82uau3igdSf9BXJ";

tx.addOutputAddress(recipient, BigInt(200000), bitcoinTestnet);
tx.addOutputAddress(changeAddress, BigInt(80000), bitcoinTestnet);

// Generate the base64 encoded PSBT that can be
// passed to a compatible wallet for signing
const psbt = tx.toPSBT(0);
export const psbtB64 = base64.encode(psbt);
