import {
  type ClearSignContext,
  ClearSignContextReferenceType,
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
  type Eip712ClearSignContextReference,
  type Eip712ValuePath,
  isEthereumClearSignContextSuccess,
} from "@ledgerhq/context-module";
import {
  bufferToHexaString,
  type DeviceModelId,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Either, Left, Right } from "purify-ts";

import { type TypedData } from "@api/model/TypedData";
import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { normalizeChainId } from "@internal/shared/utils/normalizeChainId";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";
import { resolveEip712V2Path } from "@internal/typed-data/service/v2/Eip712V2PathResolver";
import { getEip712V2PrimaryTypeHash } from "@internal/typed-data/service/v2/Eip712V2PrimaryTypeHash";
import { type Eip712V2Types } from "@internal/typed-data/service/v2/Eip712V2SchemaBuilder";

import { type ContextWithSubContexts } from "./BuildFullContextsTask";

const ADDRESS_LENGTH = 20;

export type BuildEIP712V2ContextsTaskArgs = {
  readonly contextModule: ContextModule;
  readonly data: TypedData;
  readonly parser: TypedDataParserService;
  readonly deviceModelId: DeviceModelId;
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
};

type SubcontextCallback = () => Promise<ClearSignContext>;

/** What every descriptor of one message is resolved against */
type MessageScope = {
  readonly types: Eip712V2Types;
  readonly chainId: number;
  readonly verifyingContract: string;
  readonly enums: ClearSignContextSuccess<ClearSignContextType.ETHEREUM_ENUM>[];
  /** Tokens and NFTs already given to an earlier descriptor */
  readonly providedAddresses: Set<string>;
};

/**
 * Builds the clear-signing contexts of an EIP-712 V2 message, in the order the device
 * takes them: the message info, then each field descriptor preceded by what it needs to
 * be formatted (token, NFT, trusted name or enum entry).
 *
 * No context at all means the message is reviewed raw. That is the outcome whenever the
 * message cannot be described in full: once the message info is sent, any descriptor the
 * device refuses ends the whole flow, so a partial description is worse than none.
 */
export class BuildEIP712V2ContextsTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private readonly _api: InternalApi,
    private readonly _args: BuildEIP712V2ContextsTaskArgs,
  ) {
    this._logger = _args.loggerFactory("BuildEIP712V2ContextsTask");
  }

  async run(): Promise<ContextWithSubContexts[]> {
    const { data, parser, contextModule, deviceModelId } = this._args;
    const chainId = normalizeChainId(data.domain.chainId);
    const verifyingContract = data.domain.verifyingContract;
    // the message info pins the domain's chain and contract, which CAL needs to look it up
    if (chainId === null || verifyingContract === undefined) {
      return [];
    }

    // a message the parser refuses fails when its payloads are built, not here
    const parsed = parser.parse(data);
    if (parsed.isLeft()) {
      return [];
    }
    const { types } = parsed.unsafeCoerce();

    let primaryTypeHash: string;
    try {
      primaryTypeHash = getEip712V2PrimaryTypeHash(
        data.types,
        data.primaryType,
      );
    } catch (error) {
      this._logger.debug("[run] Cannot hash the primary type", {
        data: { error },
      });
      return [];
    }

    const contexts = (
      await contextModule.getContexts(
        { verifyingContract, chainId, primaryTypeHash, deviceModelId },
        [
          ClearSignContextType.ETHEREUM_EIP712_MESSAGE_INFO,
          ClearSignContextType.ETHEREUM_EIP712_FIELD_DESCRIPTION,
          ClearSignContextType.ETHEREUM_ENUM,
        ],
      )
    ).filter(isEthereumClearSignContextSuccess);

    const info = contexts.find(
      (c) => c.type === ClearSignContextType.ETHEREUM_EIP712_MESSAGE_INFO,
    );
    if (info === undefined) {
      return [];
    }
    const enums = contexts.filter(
      (c): c is ClearSignContextSuccess<ClearSignContextType.ETHEREUM_ENUM> =>
        c.type === ClearSignContextType.ETHEREUM_ENUM,
    );
    const fields = contexts.filter(
      (
        c,
      ): c is ClearSignContextSuccess<ClearSignContextType.ETHEREUM_EIP712_FIELD_DESCRIPTION> =>
        c.type === ClearSignContextType.ETHEREUM_EIP712_FIELD_DESCRIPTION,
    );

    const scope: MessageScope = {
      types,
      chainId,
      verifyingContract,
      enums,
      // a token or an NFT is provided once, before the first descriptor that needs it
      providedAddresses: new Set<string>(),
    };
    const fieldContexts = Either.sequence(
      fields.map((field) =>
        (field.reference === undefined
          ? Right<SubcontextCallback[], Error>([])
          : this._getSubcontexts(field.reference, scope)
        ).map<ContextWithSubContexts>((subcontextCallbacks) => ({
          context: field,
          subcontextCallbacks,
        })),
      ),
    );

    return fieldContexts.caseOf({
      Left: (error) => {
        this._logger.debug("[run] Cannot describe the message", {
          data: { error },
        });
        return [];
      },
      Right: (described) => [
        { context: info, subcontextCallbacks: [] },
        ...described,
      ],
    });
  }

  private _getSubcontexts(
    reference: Eip712ClearSignContextReference,
    scope: MessageScope,
  ): Either<Error, SubcontextCallback[]> {
    const { contextModule, deviceModelId } = this._args;
    const { chainId, providedAddresses } = scope;

    switch (reference.type) {
      case ClearSignContextReferenceType.TOKEN:
      case ClearSignContextReferenceType.NFT: {
        const expectedType =
          reference.type === ClearSignContextReferenceType.TOKEN
            ? ClearSignContextType.ETHEREUM_TOKEN
            : ClearSignContextType.ETHEREUM_NFT;
        const addresses =
          reference.value !== undefined
            ? Right([reference.value.toLowerCase()])
            : this._resolveAddresses(scope, reference.valuePath);
        return addresses.map((list) => {
          const fresh = [...new Set(list)].filter(
            (address) => !providedAddresses.has(address),
          );
          fresh.forEach((address) => providedAddresses.add(address));
          return fresh.map(
            (address) => () =>
              contextModule.getFieldContext(
                { chainId, address, deviceModelId },
                expectedType,
              ),
          );
        });
      }
      case ClearSignContextReferenceType.TRUSTED_NAME:
        return this._resolveAddresses(scope, reference.valuePath).map(
          (addresses) =>
            addresses.map((address) => async () => {
              // the challenge is single use, so it is fetched right before the name it proves
              const challenge = await this._api.sendCommand(
                new GetChallengeCommand(),
              );
              if (!isSuccessCommandResult(challenge)) {
                return {
                  type: ClearSignContextType.ERROR,
                  error: new Error("Failed to get challenge"),
                };
              }
              return contextModule.getFieldContext(
                {
                  chainId,
                  address,
                  challenge: challenge.data.challenge,
                  types: reference.types,
                  sources: reference.sources,
                  deviceModelId,
                },
                ClearSignContextType.ETHEREUM_TRUSTED_NAME,
              );
            }),
        );
      case ClearSignContextReferenceType.ENUM:
        return this._resolveValues(scope, reference.valuePath).map((values) =>
          values.flatMap((value) => {
            // an enum entry is one byte, and a leaf is as short as its value
            const entry =
              value.length === 1
                ? scope.enums.find(
                    (e) => e.id === reference.id && e.value === value[0],
                  )
                : undefined;
            return entry === undefined ? [] : [() => Promise.resolve(entry)];
          }),
        );
      case ClearSignContextReferenceType.CALLDATA:
        // The device refuses to sign until the call is described as a transaction
        return Left(
          new Error("Calls named by a typed message are not supported"),
        );
      default: {
        const uncoveredType: never = reference;
        return Left(
          new Error(
            `Uncovered reference type: ${JSON.stringify(uncoveredType)}`,
          ),
        );
      }
    }
  }

  private _resolveAddresses(
    scope: MessageScope,
    valuePath: Eip712ValuePath,
  ): Either<Error, string[]> {
    if (valuePath === "TO") {
      return Right([scope.verifyingContract.toLowerCase()]);
    }
    if (valuePath === "FROM") {
      // the account that signs, which the device knows without any metadata
      return Right([]);
    }
    return this._resolveValues(scope, valuePath).map((values) =>
      values.map((value) =>
        bufferToHexaString(value.slice(-ADDRESS_LENGTH)).toLowerCase(),
      ),
    );
  }

  private _resolveValues(
    { types }: MessageScope,
    valuePath: Eip712ValuePath,
  ): Either<Error, Uint8Array[]> {
    if (typeof valuePath === "string") {
      return Left(
        new Error(`Container path ${valuePath} has no value in the message`),
      );
    }
    const { data } = this._args;
    return resolveEip712V2Path(
      types,
      data.primaryType,
      data.message,
      valuePath,
    );
  }
}
