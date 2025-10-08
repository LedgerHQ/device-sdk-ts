import { type PkiCertificate } from "@/pki/model/PkiCertificate";

import { type GenericPath } from "./GenericPath";

export enum ClearSignContextType {
  TOKEN = "token",
  NFT = "nft",
  TRUSTED_NAME = "trustedName",
  PLUGIN = "plugin",
  EXTERNAL_PLUGIN = "externalPlugin",
  TRANSACTION_INFO = "transactionInfo",
  PROXY_INFO = "proxyInfo",
  ENUM = "enum",
  TRANSACTION_FIELD_DESCRIPTION = "transactionFieldDescription",
  WEB3_CHECK = "web3Check",
  DYNAMIC_NETWORK = "dynamicNetwork",
  DYNAMIC_NETWORK_ICON = "dynamicNetworkIcon",
  ERROR = "error",
}

export enum ClearSignContextReferenceType {
  TOKEN = ClearSignContextType.TOKEN,
  NFT = ClearSignContextType.NFT,
  TRUSTED_NAME = ClearSignContextType.TRUSTED_NAME,
  ENUM = ClearSignContextType.ENUM,
  CALLDATA = "calldata",
}

export type ClearSignContextReference<
  Type extends ClearSignContextReferenceType = ClearSignContextReferenceType,
> = Type extends ClearSignContextReferenceType.ENUM
  ? {
      type: ClearSignContextReferenceType.ENUM;
      valuePath: GenericPath;
      id: number; // enum id to reference
    }
  : Type extends ClearSignContextReferenceType.TRUSTED_NAME
    ? {
        type: ClearSignContextReferenceType.TRUSTED_NAME;
        valuePath: GenericPath;
        types: string[];
        sources: string[];
      }
    : Type extends ClearSignContextReferenceType.CALLDATA
      ? {
          type: ClearSignContextReferenceType.CALLDATA;
          callee: GenericPath;
          valuePath: GenericPath;
          selector?: GenericPath;
          amount?: GenericPath;
          spender?: GenericPath;
          chainId?: GenericPath;
        }
      :
          | {
              type: Type;
              valuePath: GenericPath;
              value?: never;
            }
          | {
              type: Type;
              valuePath?: never;
              value: string;
            };

export type ClearSignContextSuccessType = Exclude<
  ClearSignContextType,
  ClearSignContextType.ERROR
>;

export type ClearSignContextSuccess<
  T extends Exclude<
    ClearSignContextType,
    ClearSignContextType.ERROR
  > = ClearSignContextSuccessType,
> = T extends ClearSignContextType.ENUM
  ? {
      type: ClearSignContextType.ENUM;
      id: number;
      payload: string;
      value: number;
      certificate?: PkiCertificate;
    }
  : T extends ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION
    ? {
        type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION;
        payload: string;
        reference?: ClearSignContextReference;
        certificate?: PkiCertificate;
      }
    : {
        type: T;
        payload: string;
        certificate?: PkiCertificate;
      };

export type ClearSignContextError = {
  type: ClearSignContextType.ERROR;
  error: Error;
};

export type ClearSignContext = ClearSignContextSuccess | ClearSignContextError;
