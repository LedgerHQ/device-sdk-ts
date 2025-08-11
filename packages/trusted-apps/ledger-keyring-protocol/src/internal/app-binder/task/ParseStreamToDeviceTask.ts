import {
  CommandResultStatus,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { type Either, EitherAsync, Left, Right } from "purify-ts";

import {
  type LKRPMissingDataError,
  type LKRPParsingError,
  LKRPUnknownError,
} from "@api/app-binder/Errors";
import { type SetTrustedMemberCommandArgs } from "@api/app-binder/SetTrustedMemberTypes";
import { ParseBlockSignatureCommand } from "@internal/app-binder/command/ParseBlockSignatureCommand";
import { ParseSingleCommand } from "@internal/app-binder/command/ParseStreamBlockCommand";
import { ParseBlockHeaderCommand } from "@internal/app-binder/command/ParseStreamBlockHeader";
import { SetTrustedMemberCommand } from "@internal/app-binder/command/SetTrustedMemberCommand";
import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";
import { type LKRPBlockParsedData } from "@internal/models/LKRPBlockTypes";
import { eitherSeqRecord } from "@internal/utils/eitherSeqRecord";
import { bytesToHex } from "@internal/utils/hex";
import { type LKRPBlock } from "@internal/utils/LKRPBlock";
import { type LKRPBlockStream } from "@internal/utils/LKRPBlockStream";
import { type LKRPCommand } from "@internal/utils/LKRPCommand";

import { TrustedProperties } from "./utils/TrustedProperties";

export type ParseStreamToDeviceTaskInput = {
  seedBlock: LKRPBlock; // The seed block is mandatory for now because the trustchain creation / parse empty stream are not yet implemented
  applicationStream: LKRPBlockStream | null;
};

type ParseStreamTaskError =
  | LKRPDeviceCommandError
  | LKRPParsingError
  | LKRPMissingDataError
  | LKRPUnknownError;

export class ParseStreamToDeviceTask {
  private lastTrustedMember: string | null = null;
  private trustedMembers = new Map<string, SetTrustedMemberCommandArgs>();

  constructor(private readonly api: InternalApi) {}

  run({ seedBlock, applicationStream }: ParseStreamToDeviceTaskInput) {
    return this.parseBlock(seedBlock).chain<ParseStreamTaskError, unknown>(
      () =>
        applicationStream
          ? this.parseStream(applicationStream)
          : EitherAsync.liftEither(Right(undefined)),
    );
  }

  parseStream(stream: LKRPBlockStream) {
    return EitherAsync.liftEither(stream.parse()).chain<
      ParseStreamTaskError,
      unknown
    >((blocks) =>
      EitherAsync.sequence(blocks.map((block) => this.parseBlock(block))),
    );
  }

  parseBlock(block: LKRPBlock) {
    return (
      EitherAsync.liftEither(block.parse())

        .chain<ParseStreamTaskError, LKRPBlockParsedData>((data) =>
          this.setTrustedMember(bytesToHex(data.issuer)).map(() => data),
        )

        // Parse the block header
        .chain<ParseStreamTaskError, LKRPBlockParsedData>(async (data) => {
          try {
            const response = await this.api.sendCommand(
              new ParseBlockHeaderCommand(data),
            );
            if (response.status !== CommandResultStatus.Success) {
              return Left(response.error);
            }
          } catch (error) {
            return Left(new LKRPUnknownError(String(error)));
          }
          return Right(data);
        })

        // Parse each command
        .chain<ParseStreamTaskError, LKRPBlockParsedData>((data) =>
          EitherAsync.sequence(
            data.commands.map((command) =>
              this.parseCommand(command, bytesToHex(data.issuer)),
            ),
          ).map(() => data),
        )

        // Parse the block signature
        .chain<ParseStreamTaskError, void>(async (data) => {
          try {
            const response = await this.api.sendCommand(
              new ParseBlockSignatureCommand(data),
            );
            if (response.status !== CommandResultStatus.Success) {
              return Left(response.error);
            }
          } catch (error) {
            return Left(new LKRPUnknownError(String(error)));
          }
          return Right(undefined);
        })
    );
  }

  parseCommand(command: LKRPCommand, blockIssuer: string) {
    const publicKey = command.getPublicKey().orDefault(blockIssuer);

    // Parse the command
    return this.setTrustedMember(publicKey).chain<
      ParseStreamTaskError,
      unknown
    >(async () => {
      try {
        const response = await this.api.sendCommand(
          new ParseSingleCommand({ command: command.toU8A() }),
        );
        if (response.status !== CommandResultStatus.Success) {
          return Left(response.error);
        }
        return this.recordTrustedMembers(publicKey, response.data);
      } catch (error) {
        return Left(new LKRPUnknownError(String(error)));
      }
    });
  }

  setTrustedMember(publicKey: string) {
    // NOTE: Set Trusted Member only when needed
    // i.e: when this command wasn't signed by the device (see recordTrustedMembers NOTE) nor the last trusted member
    return EitherAsync.fromPromise<ParseStreamTaskError, void>(async () => {
      if (publicKey === this.lastTrustedMember) {
        return Right(undefined);
      }
      const trustedMember = this.trustedMembers.get(publicKey);
      if (!trustedMember) {
        return Right(undefined);
      }
      try {
        const response = await this.api.sendCommand(
          new SetTrustedMemberCommand(trustedMember),
        );
        if (response.status !== CommandResultStatus.Success) {
          return Left(response.error);
        }
      } catch (error) {
        return Left(new LKRPUnknownError(String(error)));
      }
      return Right(undefined);
    });
  }

  recordTrustedMembers(
    publicKey: string,
    trustedPropsBytes: Uint8Array,
  ): Either<LKRPParsingError | LKRPMissingDataError, unknown> {
    this.lastTrustedMember = publicKey;

    // NOTE: Whenever a command which was signed by the device is parsed on the same device
    // the parse block apdu returns empty trusted properties.
    // Therefore this function will never record the device as a trusted member.
    // (which is fine because the device doesn't need to set itself as a trusted member).
    if (trustedPropsBytes.length === 0 || this.trustedMembers.has(publicKey)) {
      return Right(undefined);
    }

    const trustedProps = new TrustedProperties(trustedPropsBytes);
    return eitherSeqRecord({
      iv: () => trustedProps.getIv(),
      memberTlv: () => trustedProps.getNewMember(),
    }).ifRight((trustedMember) =>
      this.trustedMembers.set(publicKey, trustedMember),
    );
  }
}
