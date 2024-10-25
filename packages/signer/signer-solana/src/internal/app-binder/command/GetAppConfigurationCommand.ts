import {
    Apdu,
    ApduBuilder,
    ApduParser,
    ApduResponse,
    Command,
    CommandResult,
    CommandResultFactory,
    CommandUtils,
    GlobalCommandErrorHandler,
    InvalidStatusWordError,
  } from "@ledgerhq/device-management-kit";
  
  type GetAppConfigurationCommandResponse = {
    dummySetting1: number;
    dummySetting2: number;
    majorVersion: number;
    minorVersion: number;
    patchVersion: number;
  };
  
  type GetAppConfigurationCommandArgs = {};
  
  export class GetAppConfigurationCommand
    implements
      Command<
        GetAppConfigurationCommandResponse,
        GetAppConfigurationCommandArgs
      >
  {
    args: GetAppConfigurationCommandArgs;
  
    constructor(args: GetAppConfigurationCommandArgs) {
      this.args = args;
    }
  
    getApdu(): Apdu {
      return new ApduBuilder({
        cla: 0xe0,
        ins: 0x04, 
        p1: 0x00,
        p2: 0x00,
      }).build();
    }
  
    parseResponse(
      response: ApduResponse,
    ): CommandResult<GetAppConfigurationCommandResponse> {
      const parser = new ApduParser(response);
    
      if (!CommandUtils.isSuccessResponse(response)) {
        return CommandResultFactory({
          error: GlobalCommandErrorHandler.handle(response),
        });
      }
    
      const buffer = parser.extractFieldByLength(5);
    
      if (!buffer || buffer.length !== 5) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Invalid response length"),
        });
      }
    
      return CommandResultFactory({
        data: {
          dummySetting1: buffer[0]!,
          dummySetting2: buffer[1]!,
          majorVersion: buffer[2]!,
          minorVersion: buffer[3]!,
          patchVersion: buffer[4]!,
        },
      });
    }
  }