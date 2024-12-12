import { type Web3CheckContext, type Web3Checks } from "./web3CheckTypes";

export interface Web3CheckContextLoader {
  load(typedData: Web3CheckContext): Promise<Web3Checks>;
}
