import { type GenericPath } from "./GenericPath";

export enum ClearSignContextType {
  TOKEN = "token",
  NFT = "nft",
  TRUSTED_NAME = "trustedName",
  PLUGIN = "plugin",
  EXTERNAL_PLUGIN = "externalPlugin",
  TRANSACTION_INFO = "transactionInfo",
  ENUM = "enum",
  TRANSACTION_FIELD_DESCRIPTION = "transactionFieldDescription",
  ERROR = "error",
}

export type ClearSignContextReferenceType =
  | ClearSignContextType.TOKEN
  | ClearSignContextType.NFT
  | ClearSignContextType.ENUM
  | ClearSignContextType.TRUSTED_NAME;

export type ClearSignContextReference<
  Type extends ClearSignContextReferenceType = ClearSignContextReferenceType,
> = Type extends ClearSignContextType.ENUM
  ? {
      type: ClearSignContextType.ENUM;
      valuePath: GenericPath;
      id: number; // enum id to reference
    }
  : Type extends ClearSignContextType.TRUSTED_NAME
    ? {
        type: ClearSignContextType.TRUSTED_NAME;
        valuePath: GenericPath;
        types: string[];
        sources: string[];
      }
    : {
        type: ClearSignContextType.TOKEN | ClearSignContextType.NFT;
        valuePath: GenericPath;
      };

export type ClearSignContextSuccessType = Exclude<
  ClearSignContextType,
  ClearSignContextType.ERROR
>;

// NOTE: this is a union of all possible success types
// There is currently two types of success:
// - ENUM: which is a special case, we need to handle it differently
//         because we don't want to send the whole enum
//         but only the parts that are needed.
//          - id: the enum id to reference
//          - payload: the payload to send with a provideEnum command
//          - name: the name of the enum to be displayed on the device
//          - value: the value of the enum to be retrieved from the transaction
// - All other types
//          - payload: the payload to send with a provide command
//          - reference: the reference to the value to be retrieved from the transaction
export type ClearSignContextSuccess<
  Type extends ClearSignContextSuccessType = ClearSignContextSuccessType,
> = Type extends ClearSignContextType.ENUM
  ? {
      type: ClearSignContextType.ENUM;
      id: number;
      payload: string;
      name: string;
      value: number;
    }
  : {
      type: Exclude<
        ClearSignContextType,
        ClearSignContextType.ENUM | ClearSignContextType.ERROR
      >;
      payload: string;
      reference?: ClearSignContextReference;
    };

export type ClearSignContextError = {
  type: ClearSignContextType.ERROR;
  error: Error;
};

export type ClearSignContext = ClearSignContextSuccess | ClearSignContextError;
