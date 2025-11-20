import {
  type OpenAppDAError,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import { type CryptoService } from "@api/crypto/CryptoService";
import { type KeyPair } from "@api/crypto/KeyPair";
import {
  type LKRPDataSourceError,
  type LKRPMissingDataError,
  type LKRPOutdatedLedgerKeyRingProtocolError,
  type LKRPParsingError,
  type LKRPLedgerKeyRingProtocolNotReady,
  type LKRPUnknownError,
} from "@api/model/Errors";
import { type JWT } from "@api/model/JWT";
import { type Permissions } from "@api/model/Permissions";
import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyRingProtocolErrors";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";
import { type LedgerKeyRingProtocol } from "@internal/utils/LedgerKeyRingProtocol";

export type AddToLedgerKeyRingProtocolDAOutput = undefined;

export type AddToLedgerKeyRingProtocolDAInput = Either<
  LKRPMissingDataError,
  {
    readonly lkrpDataSource: LKRPDataSource;
    readonly cryptoService: CryptoService;
    readonly keyPair: KeyPair;
    readonly jwt: JWT;
    readonly appId: number;
    readonly LedgerKeyRingProtocol: LedgerKeyRingProtocol;
    readonly clientName: string;
    readonly permissions: Permissions;
  }
>;

export type AddToLedgerKeyRingProtocolDAError =
  | LKRPDeviceCommandError
  | LKRPDataSourceError
  | LKRPParsingError
  | LKRPMissingDataError
  | LKRPOutdatedLedgerKeyRingProtocolError
  | LKRPLedgerKeyRingProtocolNotReady
  | OpenAppDAError
  | LKRPUnknownError;

export type AddToLedgerKeyRingProtocolDAIntermediateValue =
  | {
      requiredUserInteraction: UserInteractionRequired.None;
      step?:
        | AddToLedgerKeyRingProtocoleDAStep.Initialize
        | AddToLedgerKeyRingProtocoleDAStep.ParseStream;
    }
  | {
      requiredUserInteraction: AddToLedgerKeyRingProtocolDAState.AddMember;
      step: AddToLedgerKeyRingProtocoleDAStep.AddMember;
    };

export enum AddToLedgerKeyRingProtocolDAState {
  AddMember = "lkrp-add-member",
}

export enum AddToLedgerKeyRingProtocoleDAStep {
  Initialize = "lkrp-init-transaction",
  ParseStream = "lkrp-parse-stream",
  AddMember = "lkrp-add-member",
}

export type AddToLedgerKeyRingProtocolDAInternalState = Either<
  AddToLedgerKeyRingProtocolDAError,
  {
    readonly sessionKeypair: KeyPair | null;
  }
>;
