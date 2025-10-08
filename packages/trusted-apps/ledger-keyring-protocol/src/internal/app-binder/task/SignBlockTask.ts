import {
  bufferToHexaString,
  CommandResultStatus,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { Either, EitherAsync, Left, Right } from "purify-ts";

import { type CryptoService, EncryptionAlgo } from "@api/crypto/CryptoService";
import { type KeyPair } from "@api/crypto/KeyPair";
import {
  LKRPDataSourceError,
  type LKRPMissingDataError,
  LKRPOutdatedTrustchainError,
  type LKRPParsingError,
  LKRPUnknownError,
  LKRPUnsupportedCommandError,
} from "@api/model/Errors";
import { type JWT } from "@api/model/JWT";
import { SignBlockHeaderCommand } from "@internal/app-binder/command/SignBlockHeader";
import { SignBlockSignatureCommand } from "@internal/app-binder/command/SignBlockSignatureCommand";
import { SignBlockSingleCommand } from "@internal/app-binder/command/SignBlockSingleCommand";
import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";
import {
  type AddMemberUnsignedData,
  type EncryptedCommand,
  type EncryptedDeriveCommand,
  type EncryptedPublishKeyCommand,
} from "@internal/models/LKRPCommandTypes";
import { CommandTags } from "@internal/models/Tags";
import {
  eitherAsyncSeqRecord,
  eitherSeqRecord,
} from "@internal/utils/eitherSeqRecord";
import { LKRPBlock } from "@internal/utils/LKRPBlock";
import { LKRPCommand } from "@internal/utils/LKRPCommand";

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
  sessionKeypair: KeyPair;
};

export class SignBlockTask {
  constructor(
    private readonly api: InternalApi,
    private readonly cryptoService: CryptoService,
  ) {}

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
      .chain(async (encryptedBlock) =>
        this.decryptBlock(parent, encryptedBlock),
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
      try {
        const response = await this.api.sendCommand(
          new SignBlockHeaderCommand({ parent, commandCount }),
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
    sessionKeypair: KeyPair,
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
        const secret = (
          await sessionKeypair.deriveSharedSecret(deviceSessionKey)
        ).slice(1);
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
  ): EitherAsync<SignBlockError, LKRPBlock> {
    return EitherAsync(async ({ throwE }) => {
      const key = this.cryptoService.importSymmetricKey(
        signature.secret,
        EncryptionAlgo.AES256_GCM,
      );
      const decryptedIssuer = await key.decrypt(header.iv, header.issuer);
      return Either.sequence(
        await Promise.all(
          commands.map((command) =>
            this.decryptCommand(signature.secret, command).run(),
          ),
        ),
      ).caseOf({
        Left: (error) => {
          throwE(error);
          throw error;
        },
        Right: (decryptedCommands) =>
          LKRPBlock.fromData({
            parent: bufferToHexaString(parent),
            issuer: decryptedIssuer,
            commands: decryptedCommands,
            signature: signature.signature,
          }),
      });
    });
  }

  decryptCommand(
    secret: Uint8Array,
    command: EncryptedCommand,
  ): EitherAsync<LKRPUnknownError, LKRPCommand> {
    return EitherAsync<LKRPUnknownError, LKRPCommand>(async ({ throwE }) => {
      switch (command.type) {
        case CommandTags.Derive:
        case CommandTags.PublishKey: {
          const key = this.cryptoService.importSymmetricKey(
            secret,
            EncryptionAlgo.AES256_GCM,
          );
          const encryptedXpriv = await key.decrypt(command.iv, command.xpriv);
          return LKRPCommand.fromData({
            ...command,
            initializationVector: command.commandIv,
            encryptedXpriv,
          });
        }
        case CommandTags.AddMember:
          return LKRPCommand.fromData({ ...command });
        default:
          throwE(new LKRPUnsupportedCommandError(command));
          throw new LKRPUnsupportedCommandError(command);
      }
    });
  }
}
