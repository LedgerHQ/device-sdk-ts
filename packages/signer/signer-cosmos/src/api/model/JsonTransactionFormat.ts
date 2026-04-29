import { type JsonObject } from "@api/model/JsonObject";

interface Amount extends JsonObject {
  amount: string;
  denom: string;
}

interface Fee extends JsonObject {
  amount: Amount[];
  gas: string;
}

interface Input extends JsonObject {
  address: string;
  coins: Amount[];
}

interface Output extends JsonObject {
  address: string;
  coins: Amount[];
}

interface Message extends JsonObject {
  inputs: Input[];
  outputs: Output[];
}

export interface JsonTransactionFormat extends JsonObject {
  account_number: string;
  chain_id: string;
  fee: Fee;
  memo: string;
  msgs: Message[];
  sequence: string;
}
