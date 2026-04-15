import {
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import { type LKRPUnknownError } from "@api/model/Errors";
import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";

export type LedgerProofDAOutput = Uint8Array;

export type LedgerProofDAInput = {
  readonly operation: "encrypt" | "decrypt";
  readonly data: Uint8Array;
};

export type LedgerProofDAError =
  | OpenAppDAError
  | LKRPDeviceCommandError
  | LKRPUnknownError;

export type LedgerProofDAIntermediateValue =
  | {
      requiredUserInteraction: OpenAppDARequiredInteraction;
      step: LedgerProofDAStep.OpenApp;
    }
  | {
      requiredUserInteraction: UserInteractionRequired.None;
      step?: LedgerProofDAStep.ExecuteOperation;
    };

export enum LedgerProofDAStep {
  OpenApp = "ledger-proof.steps.openApp",
  ExecuteOperation = "ledger-proof.steps.executeOperation",
}

export type LedgerProofDAInternalState = Either<
  LedgerProofDAError,
  {
    readonly result: Uint8Array | null;
  }
>;

export type LedgerProofDAReturnType = ExecuteDeviceActionReturnType<
  LedgerProofDAOutput,
  LedgerProofDAError,
  LedgerProofDAIntermediateValue
>;
