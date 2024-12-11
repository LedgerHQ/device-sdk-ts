import { KeyType, PublicKey } from "@near-js/crypto";
import {
  AccessKey,
  AccessKeyPermission,
  Action,
  actionCreators,
  CreateAccount,
  DelegateAction,
  DeleteAccount,
  DeleteKey,
  DeployContract,
  FunctionCall,
  FunctionCallPermission,
  Signature,
  SignedDelegate,
  Stake,
  Transfer,
} from "@near-js/transactions";

const publicKey = PublicKey.fromString(
  "ed25519:EFr6nRvgKKeteKoEH7hudt8UHYiu94Liq2yMM7x2AU9U",
);
function createAccount() {
  return new Action({ createAccount: new CreateAccount() });
}

function deployContract(): Action {
  const code = crypto.getRandomValues(new Uint8Array(42));
  return new Action({ deployContract: new DeployContract({ code }) });
}

function functionCall(): Action {
  return new Action({
    functionCall: new FunctionCall({
      methodName: "testMethod",
      args: Uint8Array.from([21 * 1e23]),
      gas: BigInt(1e20),
      deposit: BigInt(42 * 1e24),
    }),
  });
}

function stake(): Action {
  return new Action({
    stake: new Stake({ stake: BigInt(42 * 1e23), publicKey }),
  });
}

function transfer(): Action {
  return new Action({ transfer: new Transfer({ deposit: BigInt(42 * 1e23) }) });
}

function addKey() {
  const accessKey = new AccessKey({
    nonce: BigInt(0),
    permission: new AccessKeyPermission({
      functionCall: new FunctionCallPermission({
        receiverId: "alice.near",
        allowance: BigInt(42),
        methodNames: ["method"],
      }),
    }),
  });
  return actionCreators.addKey(publicKey, accessKey);
}

function deleteKey(): Action {
  return new Action({ deleteKey: new DeleteKey({ publicKey }) });
}

function deleteAccount(): Action {
  return new Action({
    deleteAccount: new DeleteAccount({ beneficiaryId: "bob.near" }),
  });
}

function signedDelegate(): Action {
  return new Action({
    signedDelegate: new SignedDelegate({
      delegateAction: new DelegateAction({
        senderId: "bob.near",
        receiverId: "alice.near",
        actions: [transfer()],
        publicKey,
        nonce: BigInt(42),
        maxBlockHeight: BigInt(42),
      }),
      signature: new Signature({
        keyType: KeyType.ED25519,
        data: Uint8Array.from([42]),
      }),
    }),
  });
}

export const signTransactionActions: Record<string, () => Action> = {
  createAccount,
  deployContract,
  functionCall,
  stake,
  transfer,
  addKey,
  deleteKey,
  deleteAccount,
  signedDelegate,
};
