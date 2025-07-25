import {
  CommandResultStatus,
  type InternalApi,
  UnknownDAError,
} from "@ledgerhq/device-management-kit";
import { type Either, EitherAsync, Left, Right } from "purify-ts";

import {
  type LKRPHttpRequestError,
  type LKRPMissingDataError,
  type LKRPParsingError,
} from "@api/app-binder/Errors";
import { type JWT, type Keypair } from "@api/index";
import { SignBlockHeaderCommand } from "@internal/app-binder/command/SignBlockHeader";
import { SignBlockSignatureCommand } from "@internal/app-binder/command/SignBlockSignatureCommand";
import { SignBlockSingleCommand } from "@internal/app-binder/command/SignBlockSingleCommand";
import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";
import {
  eitherSeqRecord,
  eitherSeqRecordAsync,
} from "@internal/utils/eitherSeqRecord";
import { type LKRPBlock } from "@internal/utils/LKRPBlock";
import { LKRPCommand } from "@internal/utils/LKRPCommand";
import { CommandTags, GeneralTags } from "@internal/utils/TLVTags";
import {
  type AddMemberUnsignedData,
  type EncryptedCommand,
  type EncryptedDeriveCommand,
  type EncryptedPublishKeyCommand,
} from "@internal/utils/types";

import { TrustedProperties } from "./utils/TrustedProperties";

type BlockFlow =
  | { type: "derive"; data: AddMemberBlockData }
  | { type: "addMember"; data: AddMemberBlockData };

type AddMemberBlockData = {
  name: string;
  publicKey: Uint8Array;
  permissions: number;
};

type HeaderPayload = {
  iv: Uint8Array;
  issuer: Uint8Array;
};
type SignaturePayload = {
  secret: Uint8Array;
  signature: Uint8Array;
};

type SignBlockError =
  | LKRPDeviceCommandError
  | LKRPParsingError
  | LKRPMissingDataError
  | LKRPHttpRequestError
  | UnknownDAError;

export const ISSUER_PLACEHOLDER = new Uint8Array([
  3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
]);

export class SignBlockTask {
  constructor(
    private readonly api: InternalApi,
    private readonly lkrpDataSource: LKRPDataSource,
  ) {}

  run(
    trustchainId: string,
    applicationPath: string,
    jwt: JWT,
    parent: Uint8Array,
    blockFlow: BlockFlow,
    sessionKeypair: Keypair,
  ): EitherAsync<SignBlockError, LKRPBlock> {
    const commands = this.signCommands(applicationPath, blockFlow);
    return eitherSeqRecordAsync({
      header: this.signBlockHeader(parent, commands.length),
      commands: EitherAsync.sequence(commands),
      signature: this.signBlockSignature(sessionKeypair),
    })
      .chain((encryptedBlock) => this.decryptBlock(encryptedBlock))
      .chain((block) => {
        switch (blockFlow.type) {
          case "derive":
            return this.lkrpDataSource
              .postDerivation(trustchainId, block, jwt)
              .map(() => block);
          default:
            return this.lkrpDataSource
              .putCommands(trustchainId, applicationPath, block, jwt)
              .map(() => block);
        }
      });
  }

  signBlockHeader(
    parent: Uint8Array,
    commandCount: number,
  ): EitherAsync<SignBlockError, HeaderPayload> {
    return EitherAsync.fromPromise(async () => {
      const header = Uint8Array.from(
        [
          [GeneralTags.Int, 1, 1], // Version 1
          [
            GeneralTags.PublicKey,
            ISSUER_PLACEHOLDER.length,
            ...ISSUER_PLACEHOLDER,
          ], // Placeholder for issuer public key (will be replaced by the device)
          [GeneralTags.Hash, parent.length, ...parent], // Parent block hash
          [GeneralTags.Int, 1, commandCount],
        ].flat(),
      );
      try {
        const response = await this.api.sendCommand(
          new SignBlockHeaderCommand({ header }),
        );
        if (response.status !== CommandResultStatus.Success) {
          return Left(response.error);
        }
        const trustedProps = new TrustedProperties(response.data);
        return eitherSeqRecord({
          iv: () => trustedProps.getIv(),
          issuer: () => trustedProps.getIssuer(),
        }) as Either<SignBlockError, HeaderPayload>;
      } catch (error) {
        return Left(new UnknownDAError(String(error)));
      }
    });
  }

  signBlockSignature(
    sessionKeypair: Keypair,
  ): EitherAsync<SignBlockError, SignaturePayload> {
    return EitherAsync.fromPromise(async () => {
      try {
        const response = await this.api.sendCommand(
          new SignBlockSignatureCommand(),
        );
        if (response.status !== CommandResultStatus.Success) {
          return Left(response.error);
        }
        const { signature, deviceSessionKey } = response.data;
        const secret = sessionKeypair.edch(deviceSessionKey);
        return Right({ signature, secret });
      } catch (error) {
        return Left(new UnknownDAError(String(error)));
      }
    });
  }

  signCommands(
    applicationPath: string,
    block: BlockFlow,
  ): EitherAsync<SignBlockError, EncryptedCommand>[] {
    switch (block.type) {
      case "derive":
        return [
          this.signDeriveCommand(applicationPath),
          this.signAddMemberCommand(block.data),
          this.signPublishKeyCommand(block.data),
        ];
      case "addMember":
        return [
          this.signAddMemberCommand(block.data),
          this.signPublishKeyCommand(block.data),
        ];
    }
  }

  signSingleCommand(command: Uint8Array) {
    return EitherAsync.fromPromise(
      async (): Promise<Either<SignBlockError, TrustedProperties>> => {
        try {
          const response = await this.api.sendCommand(
            new SignBlockSingleCommand({ command }),
          );
          if (response.status !== CommandResultStatus.Success) {
            return Left(response.error);
          }
          return Right(new TrustedProperties(response.data));
        } catch (error) {
          return Left(new UnknownDAError(String(error)));
        }
      },
    );
  }

  signDeriveCommand(applicationPath: string) {
    return this.signSingleCommand(
      LKRPCommand.bytesFromUnsignedData({
        type: CommandTags.Derive,
        path: applicationPath,
      }),
    ).chain((trustedProps) =>
      EitherAsync.liftEither<SignBlockError, EncryptedDeriveCommand>(
        eitherSeqRecord({
          type: CommandTags.Derive,
          path: applicationPath,
          iv: () => trustedProps.getIv(),
          xpriv: () => trustedProps.getXPriv(),
          ephemeralPublicKey: () => trustedProps.getEphemeralPublicKey(),
          commandIv: () => trustedProps.getCommandIv(),
          groupKey: () => trustedProps.getGroupKey(),
          newMember: () => trustedProps.getNewMember(), // Just validate it's there
        }),
      ),
    );
  }

  signAddMemberCommand({ name, publicKey, permissions }: AddMemberBlockData) {
    return this.signSingleCommand(
      LKRPCommand.bytesFromUnsignedData({
        type: CommandTags.AddMember,
        name,
        publicKey,
        permissions,
      }),
    ).chain((trustedProps) =>
      EitherAsync.liftEither<SignBlockError, AddMemberUnsignedData>(
        eitherSeqRecord({
          type: CommandTags.AddMember,
          name,
          publicKey,
          permissions,
          iv: () => trustedProps.getIv(), // Just validate it's there
          newMember: () => trustedProps.getNewMember(), // Just validate it's there
        }),
      ),
    );
  }

  signPublishKeyCommand({ publicKey }: Pick<AddMemberBlockData, "publicKey">) {
    return this.signSingleCommand(
      LKRPCommand.bytesFromUnsignedData({
        type: CommandTags.PublishKey,
        recipient: publicKey,
      }),
    ).chain((trustedProps) =>
      EitherAsync.liftEither<SignBlockError, EncryptedPublishKeyCommand>(
        eitherSeqRecord({
          type: CommandTags.PublishKey,
          recipient: publicKey,
          iv: () => trustedProps.getIv(),
          xpriv: () => trustedProps.getXPriv(),
          ephemeralPublicKey: () => trustedProps.getEphemeralPublicKey(),
          commandIv: () => trustedProps.getCommandIv(),
          newMember: () => trustedProps.getNewMember(), // Just validate it's there,
        }),
      ),
    );
  }

  decryptBlock({
    header,
    commands,
    signature,
  }: {
    header: HeaderPayload;
    commands: EncryptedCommand[];
    signature: SignaturePayload;
  }): EitherAsync<SignBlockError, LKRPBlock> {
    console.log(header, commands, signature);
    return EitherAsync.liftEither(
      Left(new UnknownDAError("Not implemented yet")),
    );
  }

  decryptCommand(
    secret: Uint8Array,
    command: EncryptedCommand,
  ): EitherAsync<UnknownDAError, LKRPCommand> {
    console.log(secret, command);
    return EitherAsync.liftEither(
      Left(new UnknownDAError("Not implemented yet")),
    );
  }
}
