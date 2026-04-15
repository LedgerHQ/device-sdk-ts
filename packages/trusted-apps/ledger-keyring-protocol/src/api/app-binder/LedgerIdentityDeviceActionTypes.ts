import {
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import { type LKRPUnknownError } from "@api/model/Errors";
import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";

export type LedgerIdentityDAOutput = Uint8Array;

export type LedgerIdentityDAInput = {
  readonly operation: "encrypt" | "decrypt";
  readonly data: Uint8Array;
};

export type LedgerIdentityDAError =
  | OpenAppDAError
  | LKRPDeviceCommandError
  | LKRPUnknownError;

export type LedgerIdentityDAIntermediateValue =
  | {
      requiredUserInteraction: OpenAppDARequiredInteraction;
      step: LedgerIdentityDAStep.OpenApp;
    }
  | {
      requiredUserInteraction: UserInteractionRequired.None;
      step?: LedgerIdentityDAStep.ExecuteOperation;
    };

export enum LedgerIdentityDAStep {
  OpenApp = "ledger-identity.steps.openApp",
  ExecuteOperation = "ledger-identity.steps.executeOperation",
}

export type LedgerIdentityDAInternalState = Either<
  LedgerIdentityDAError,
  {
    readonly result: Uint8Array | null;
  }
>;

export type LedgerIdentityDAReturnType = ExecuteDeviceActionReturnType<
  LedgerIdentityDAOutput,
  LedgerIdentityDAError,
  LedgerIdentityDAIntermediateValue
>;
