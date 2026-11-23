import {
  type ClearSignContext,
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  DeviceModelId,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";

import { BuildMptContextTask } from "./BuildMptContextTask";

const ISSUANCE_ID = "000000050511E17DB83BB6F113939D67BC8EA539EDC926FC";
const MPT_PAYMENT = hexaStringToBuffer(
  `120000 6160 00000000000004D2 ${ISSUANCE_ID}`.replace(/\s/g, ""),
)!;
const XRP_PAYMENT = hexaStringToBuffer("1200006140000000000f4240")!;

const certificate = { keyUsageNumber: 8, payload: new Uint8Array([0x01]) };
const mptContext = (payload: string): ClearSignContext => ({
  type: ClearSignContextType.XRP_MPT,
  payload,
  certificate,
});

describe("BuildMptContextTask", () => {
  const getContexts = vi.fn();
  const contextModule = { getContexts } as unknown as ContextModule;

  const run = (transaction: Uint8Array) =>
    new BuildMptContextTask({
      contextModule,
      transaction,
      deviceModelId: DeviceModelId.FLEX,
    }).run();

  beforeEach(() => {
    vi.clearAllMocks();
    getContexts.mockResolvedValue([mptContext("aa")]);
  });

  it("should ask the context module for the MPT of the transaction", async () => {
    const result = await run(MPT_PAYMENT);

    expect(getContexts).toHaveBeenCalledWith(
      { mptIssuanceIds: [ISSUANCE_ID], deviceModelId: DeviceModelId.FLEX },
      [ClearSignContextType.XRP_MPT],
    );
    expect(result).toEqual([mptContext("aa")]);
  });

  it("should drop the error contexts", async () => {
    getContexts.mockResolvedValue([
      { type: ClearSignContextType.ERROR, error: new Error("unknown MPT") },
      mptContext("aa"),
    ]);

    expect(await run(MPT_PAYMENT)).toEqual([mptContext("aa")]);
  });

  it("should keep no more contexts than the app has slots", async () => {
    getContexts.mockResolvedValue([
      mptContext("aa"),
      mptContext("bb"),
      mptContext("cc"),
    ]);

    expect(await run(MPT_PAYMENT)).toEqual([
      mptContext("aa"),
      mptContext("bb"),
    ]);
  });

  it("should return no context and not call CAL when the transaction holds no MPT", async () => {
    expect(await run(XRP_PAYMENT)).toEqual([]);
    expect(getContexts).not.toHaveBeenCalled();
  });
});
