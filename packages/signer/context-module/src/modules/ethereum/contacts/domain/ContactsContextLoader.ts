import {
  DeviceModelId,
  isHexaString,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { contactsTypes } from "@/modules/ethereum/contacts/di/contactsTypes";
import {
  type ContactDecoration,
  type ContactsDataSource,
} from "@/modules/ethereum/contacts/domain/ContactsDataSource";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

export type ContactsContextInput = {
  chainId: number;
  from?: string;
  to?: string;
  deviceModelId: DeviceModelId;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL,
  ClearSignContextType.ETHEREUM_CONTACT_LEDGER_ACCOUNT,
];

const isResolvableAddress = (value: unknown): value is string =>
  typeof value === "string" && isHexaString(value) && value !== "0x";

// The wire-layer Send*Tasks pass `derivationPath` through
// `packDerivationPath`, which parses each segment as a number and
// chokes on a leading "m"/"M". The deleted ProvideContact /
// ProvideLedgerAccount use-cases stripped the prefix; with the M9
// auto-dispatch the loader is the new normalisation point so the data
// source can keep storing paths in either convention.
const stripMPrefix = (path: string): string =>
  path.startsWith("m/") || path.startsWith("M/") ? path.slice(2) : path;

@injectable()
export class ContactsContextLoader
  implements ContextLoader<ContactsContextInput>
{
  private logger: LoggerPublisherService;

  constructor(
    @inject(contactsTypes.ContactsDataSource)
    private _dataSource: ContactsDataSource,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("ContactsContextLoader");
  }

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is ContactsContextInput {
    if (
      typeof input !== "object" ||
      input === null ||
      !("chainId" in input) ||
      typeof input.chainId !== "number" ||
      !("deviceModelId" in input) ||
      input.deviceModelId === undefined
    ) {
      return false;
    }
    const hasFrom = "from" in input && isResolvableAddress(input.from);
    const hasTo = "to" in input && isResolvableAddress(input.to);
    if (!hasFrom && !hasTo) {
      return false;
    }
    return SUPPORTED_TYPES.some((type) => expectedTypes.includes(type));
  }

  async load(input: ContactsContextInput): Promise<ClearSignContext[]> {
    const contexts: ClearSignContext[] = [];

    const lookups = await Promise.all([
      isResolvableAddress(input.from)
        ? this._dataSource
            .lookupFrom({ address: input.from, chainId: input.chainId })
            .catch((error: unknown) => {
              this.logger.debug("[ContactsContextLoader] lookupFrom failed", {
                data: { error },
              });
              return null;
            })
        : Promise.resolve(null),
      isResolvableAddress(input.to)
        ? this._dataSource
            .lookupTo({ address: input.to, chainId: input.chainId })
            .catch((error: unknown) => {
              this.logger.debug("[ContactsContextLoader] lookupTo failed", {
                data: { error },
              });
              return null;
            })
        : Promise.resolve(null),
    ]);

    const [fromMatch, toMatch] = lookups;

    if (fromMatch && input.from) {
      contexts.push({
        type: ClearSignContextType.ETHEREUM_CONTACT_LEDGER_ACCOUNT,
        payload: "",
        decoration: {
          ...fromMatch,
          derivationPath: stripMPrefix(fromMatch.derivationPath),
        },
        address: input.from,
      });
    }

    if (toMatch && input.to) {
      contexts.push(this._asContext(toMatch, input.to));
    }

    return contexts;
  }

  private _asContext(
    decoration: ContactDecoration,
    address: string,
  ): ClearSignContext {
    if (decoration.kind === "ledgerAccount") {
      const { kind: _kind, ...rest } = decoration;
      return {
        type: ClearSignContextType.ETHEREUM_CONTACT_LEDGER_ACCOUNT,
        payload: "",
        decoration: {
          ...rest,
          derivationPath: stripMPrefix(rest.derivationPath),
        },
        address,
      };
    }
    const { kind: _kind, ...rest } = decoration;
    return {
      type: ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL,
      payload: "",
      decoration: {
        ...rest,
        derivationPath: stripMPrefix(rest.derivationPath),
      },
      address,
    };
  }
}
