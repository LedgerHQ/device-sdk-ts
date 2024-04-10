import { ApduResponse, ApduResponseConstructorArgs } from "./ApduResponse";

type ApduResponseStub = (
  props?: Partial<ApduResponseConstructorArgs>,
) => ApduResponse;

export const defaultApduResponseStubBuilder: ApduResponseStub = ({
  statusCode = Uint8Array.from([0x90, 0x00]),
  data = Uint8Array.from([]),
} = {}) => new ApduResponse({ statusCode, data });
