import { Apdu, ApduBuilder, ApduBuilderArgs, ApduParser, ApduResponse, CommandResult, CommandResultFactory, InvalidStatusWordError, isHexaString, type Command } from "@ledgerhq/device-management-kit";
import { CANTON_APP_ERRORS, CantonAppCommandErrorFactory, CantonAppErrorCodes } from "@internal/app-binder/command/utils/CantonApplicationErrors";
import { CommandErrorHelper, DerivationPathUtils } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

export type GetAddressCommandArgs = {
  derivationPath: string;
  checkOnDevice: boolean;
};

export type GetAddressCommandResponse = {
  publicKey: string;
  address: string;
};

export class GetAddressCommand implements Command<GetAddressCommandResponse, GetAddressCommandArgs, CantonAppErrorCodes> {

  private readonly errorHelper = new CommandErrorHelper<GetAddressCommandResponse, CantonAppErrorCodes>(
    CANTON_APP_ERRORS,
    CantonAppCommandErrorFactory,
  );

  constructor(private args: GetAddressCommandArgs) {}

  getApdu(): Apdu {
    const getEthAddressArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x02,
      p1: this.args.checkOnDevice ? 0x01 : 0x00,
      p2: 0x00,
    };
    const builder = new ApduBuilder(getEthAddressArgs);
    const derivationPath = this.args.derivationPath;

    const path = DerivationPathUtils.splitPath(derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, CantonAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      const publicKeyLength = parser.extract8BitUInt();
      if (publicKeyLength === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Public key length is missing"),
        });
      }

      if (parser.testMinimalLength(publicKeyLength) === false) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Public key is missing"),
        });
      }

      const publicKey = parser.encodeToHexaString(
        parser.extractFieldByLength(publicKeyLength),
      );

      const addressLength = parser.extract8BitUInt();
      if (addressLength === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            "Canton address length is missing",
          ),
        });
      }

      if (parser.testMinimalLength(addressLength) === false) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Canton address is missing"),
        });
      }

      const result = parser.encodeToString(
        parser.extractFieldByLength(addressLength),
      );

      const address = `0x${result}`;

      if (isHexaString(address) === false) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Invalid Canton address"),
        });
      }

      return CommandResultFactory({
        data: {
          publicKey,
          address,
        } as GetAddressCommandResponse,
      });
    });
  }
}
