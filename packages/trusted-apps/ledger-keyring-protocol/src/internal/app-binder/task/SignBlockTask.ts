import {
  bufferToHexaString,
  CommandResultStatus,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { Either, EitherAsync, Left, Right } from "purify-ts";

import {
  LKRPDataSourceError,
  type LKRPMissingDataError,
  LKRPOutdatedTrustchainError,
  type LKRPParsingError,
  LKRPUnknownError,
  LKRPUnsupportedCommandError,
} from "@api/app-binder/Errors";
import { type JWT, type Keypair } from "@api/index";
import { SignBlockHeaderCommand } from "@internal/app-binder/command/SignBlockHeader";
import { SignBlockSignatureCommand } from "@internal/app-binder/command/SignBlockSignatureCommand";
import { SignBlockSingleCommand } from "@internal/app-binder/command/SignBlockSingleCommand";
import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";
import { CryptoUtils } from "@internal/utils/crypto";
import {
  eitherAsyncSeqRecord,
  eitherSeqRecord,
} from "@internal/utils/eitherSeqRecord";
import { LKRPBlock } from "@internal/utils/LKRPBlock";
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

type EncryptedBlock = {
  header: HeaderPayload;
  commands: EncryptedCommand[];
  signature: SignaturePayload;
};

type SignBlockError =
  | LKRPDeviceCommandError
  | LKRPParsingError
  | LKRPMissingDataError
  | LKRPDataSourceError
  | LKRPOutdatedTrustchainError
  | LKRPUnknownError;

export type SignBlockTaskInput = {
  lkrpDataSource: LKRPDataSource;
  trustchainId: string;
  path: string;
  jwt: JWT;
  parent: Uint8Array;
  blockFlow: BlockFlow;
  sessionKeypair: Keypair;
};

export const ISSUER_PLACEHOLDER = new Uint8Array([
  3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
]);

export class SignBlockTask {
  constructor(private readonly api: InternalApi) {}

  run({
    lkrpDataSource,
    trustchainId,
    path,
    jwt,
    parent,
    blockFlow,
    sessionKeypair,
  }: SignBlockTaskInput): EitherAsync<SignBlockError, void> {
    const commands = this.signCommands(path, blockFlow);
    return eitherAsyncSeqRecord({
      header: this.signBlockHeader(parent, commands.length),
      commands: EitherAsync.sequence(commands),
      signature: this.signBlockSignature(sessionKeypair),
    })
      .chain((encryptedBlock) =>
        EitherAsync.liftEither(this.decryptBlock(parent, encryptedBlock)),
      )
      .chain((block) => {
        switch (blockFlow.type) {
          case "derive":
            return lkrpDataSource.postDerivation(trustchainId, block, jwt);
          case "addMember":
            return lkrpDataSource.putCommands(trustchainId, path, block, jwt);
        }
      })
      .mapLeft((error) =>
        error instanceof LKRPDataSourceError && error.status === "BAD_REQUEST"
          ? new LKRPOutdatedTrustchainError()
          : error,
      );
  }

  signBlockHeader(
    parent: Uint8Array,
    commandCount: number,
  ): EitherAsync<SignBlockError, HeaderPayload> {
    return EitherAsync.fromPromise(async () => {
      const header = Uint8Array.from(
        [
          [GeneralTags.Int, 1, 1], // Version 1
          [GeneralTags.Hash, parent.length, ...parent], // Parent block hash
          [
            GeneralTags.PublicKey,
            ISSUER_PLACEHOLDER.length,
            ...ISSUER_PLACEHOLDER,
          ], // Placeholder for issuer public key (will be replaced by the device)
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
        return Left(new LKRPUnknownError(String(error)));
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
        // At this step, the shared secret is used directly as an encryption key after removing the first byte
        const secret = sessionKeypair.ecdh(deviceSessionKey).slice(1);
        return Right({ signature, secret });
      } catch (error) {
        return Left(new LKRPUnknownError(String(error)));
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
          return Left(new LKRPUnknownError(String(error)));
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

  decryptBlock(
    parent: Uint8Array,
    { header, commands, signature }: EncryptedBlock,
  ): Either<SignBlockError, LKRPBlock> {
    const decryptedIssuer = CryptoUtils.decrypt(
      signature.secret,
      header.iv,
      header.issuer,
    );
    return Either.sequence(
      commands.map((command) => this.decryptCommand(signature.secret, command)),
    ).map((decryptedCommands) =>
      LKRPBlock.fromData({
        parent: bufferToHexaString(parent),
        issuer: decryptedIssuer,
        commands: decryptedCommands,
        signature: signature.signature,
      }),
    );
  }

  decryptCommand(
    secret: Uint8Array,
    command: EncryptedCommand,
  ): Either<LKRPUnknownError, LKRPCommand> {
    switch (command.type) {
      case CommandTags.Derive:
      case CommandTags.PublishKey: {
        const encryptedXpriv = CryptoUtils.decrypt(
          secret,
          command.iv,
          command.xpriv,
        );
        return Right(
          LKRPCommand.fromData({
            ...command,
            initializationVector: command.commandIv,
            encryptedXpriv,
          }),
        );
      }
      case CommandTags.AddMember:
        return Right(LKRPCommand.fromData({ ...command }));
      default:
        return Left(new LKRPUnsupportedCommandError(command));
    }
  }
}
