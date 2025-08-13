import {
  type OpenAppDAError,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";
import { type Trustchain } from "@internal/utils/Trustchain";

import {
  type LKRPDataSourceError,
  type LKRPMissingDataError,
  type LKRPOutdatedTrustchainError,
  type LKRPParsingError,
  type LKRPTrustchainNotReady,
  type LKRPUnknownError,
} from "./Errors";
import { type JWT, type Keypair, type Permissions } from "./LKRPTypes";

export type AddToTrustchainDAOutput = undefined;

export type AddToTrustchainDAInput = Either<
  LKRPMissingDataError,
  {
    readonly lkrpDataSource: LKRPDataSource;
    readonly keypair: Keypair;
    readonly jwt: JWT;
    readonly appId: number;
    readonly trustchain: Trustchain;
    readonly clientName: string;
    readonly permissions: Permissions;
  }
>;

export type AddToTrustchainDAError =
  | LKRPDeviceCommandError
  | LKRPDataSourceError
  | LKRPParsingError
  | LKRPMissingDataError
  | LKRPOutdatedTrustchainError
  | LKRPTrustchainNotReady
  | OpenAppDAError
  | LKRPUnknownError;

export type AddToTrustchainDAIntermediateValue =
  | {
      requiredUserInteraction: UserInteractionRequired.None;
      step?:
        | AddToTrustchaineDAStep.Initialize
        | AddToTrustchaineDAStep.ParseStream;
    }
  | {
      requiredUserInteraction: AddToTrustchainDAState.AddMember;
      step: AddToTrustchaineDAStep.AddMember;
    };

export enum AddToTrustchainDAState {
  AddMember = "lkrp-add-member",
}

export enum AddToTrustchaineDAStep {
  Initialize = "lkrp-init-transaction",
  ParseStream = "lkrp-parse-stream",
  AddMember = "lkrp-add-member",
}

export type AddToTrustchainDAInternalState = Either<
  AddToTrustchainDAError,
  {
    readonly sessionKeypair: Keypair | null;
  }
>;
