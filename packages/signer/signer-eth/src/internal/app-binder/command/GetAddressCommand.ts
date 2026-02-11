import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
  isHexaString,
} from "@ledgerhq/device-management-kit";
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  type GetAddressCommandArgs,
  type GetAddressCommandResponse,
} from "@api/app-binder/GetAddressCommandTypes";

import {
  ETH_APP_ERRORS,
  EthAppCommandErrorFactory,
  type EthErrorCodes,
} from "./utils/ethAppErrors";

const CHAIN_CODE_LENGTH = 32;

export class GetAddressCommand
  implements
    Command<GetAddressCommandResponse, GetAddressCommandArgs, EthErrorCodes>
{
  readonly name = "getAddress";
  private readonly args: GetAddressCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    GetAddressCommandResponse,
    EthErrorCodes
  >(ETH_APP_ERRORS, EthAppCommandErrorFactory);

  constructor(args: GetAddressCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const getEthAddressArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x02,
      p1: this.args.checkOnDevice ? 0x01 : 0x00,
      p2: this.args.returnChainCode ? 0x01 : 0x00,
    };
    const builder = new ApduBuilder(getEthAddressArgs);
    const derivationPath = this.args.derivationPath;

    const path = DerivationPathUtils.splitPath(derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    // Chain ID as 64-bit big-endian value in APDU data. Default to 1 (Ethereum mainnet) when omitted.
    if (this.args.chainId !== undefined) {
      const chainId = this.args.chainId;
      builder.add64BitUIntToData(chainId);
    }

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetAddressCommandResponse, EthErrorCodes> {
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
            "Ethereum address length is missing",
          ),
        });
      }

      if (parser.testMinimalLength(addressLength) === false) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Ethereum address is missing"),
        });
      }

      const result = parser.encodeToString(
        parser.extractFieldByLength(addressLength),
      );

      const address = `0x${result}`;

      if (isHexaString(address) === false) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Invalid Ethereum address"),
        });
      }

      let chainCode = undefined;
      if (this.args.returnChainCode) {
        if (parser.testMinimalLength(CHAIN_CODE_LENGTH) === false) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("Invalid Chaincode"),
          });
        }

        chainCode = parser.encodeToHexaString(
          parser.extractFieldByLength(CHAIN_CODE_LENGTH),
        );
      }

      return CommandResultFactory({
        data: {
          publicKey,
          address,
          chainCode,
        },
      });
    });
  }
}
