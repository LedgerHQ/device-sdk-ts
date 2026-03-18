import { ApduResponse, type ApduResponseConstructorArgs } from "./ApduResponse";

const SW1_SUCCESS = 0x90;

type ApduResponseStub = (
  props?: Partial<ApduResponseConstructorArgs>,
) => ApduResponse;

export const defaultApduResponseStubBuilder: ApduResponseStub = ({
  statusCode = Uint8Array.from([SW1_SUCCESS, 0x00]),
  data = Uint8Array.from([]),
} = {}) => new ApduResponse({ statusCode, data });
