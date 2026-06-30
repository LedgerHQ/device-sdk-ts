import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import { PcztHeaderCommand } from "@internal/app-binder/command/PcztHeaderCommand";
import { PcztOrchardActionCommand } from "@internal/app-binder/command/PcztOrchardActionCommand";
import { PcztTransparentInputCommand } from "@internal/app-binder/command/PcztTransparentInputCommand";
import { PcztTransparentOutputCommand } from "@internal/app-binder/command/PcztTransparentOutputCommand";
import {
  PCZT_P1,
  PCZT_P2,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

const DATA = Uint8Array.of(0x01, 0x02);
const apduHex = (raw: Uint8Array): string => Buffer.from(raw).toString("hex");

const success = new ApduResponse({
  statusCode: Uint8Array.of(0x90, 0x00),
  data: new Uint8Array(),
});
const rejected = new ApduResponse({
  statusCode: Uint8Array.of(0x69, 0x85), // ConditionOfUseNotSatisfied
  data: new Uint8Array(),
});

describe("PCZT bundle commands", () => {
  describe("PcztHeaderCommand", () => {
    it("builds INS 0x52 with P1_FIRST / P2_CONTINUE", () => {
      const apdu = new PcztHeaderCommand({ data: DATA }).getApdu().getRawApdu();
      expect(apduHex(apdu)).toBe("e052000002" + "0102");
    });

    it("maps the success status word to a successful result", () => {
      const result = new PcztHeaderCommand({ data: DATA }).parseResponse(
        success,
      );
      expect(isSuccessCommandResult(result)).toBe(true);
    });

    it("surfaces a device error status word", () => {
      const result = new PcztHeaderCommand({ data: DATA }).parseResponse(
        rejected,
      );
      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });

  describe("PcztTransparentInputCommand", () => {
    it("builds INS 0x53 with the supplied P1/P2 framing", () => {
      const apdu = new PcztTransparentInputCommand({
        data: DATA,
        p1: PCZT_P1.LAST,
        p2: PCZT_P2.CONTINUE,
      })
        .getApdu()
        .getRawApdu();
      expect(apduHex(apdu)).toBe("e053010002" + "0102");
    });
  });

  describe("PcztTransparentOutputCommand", () => {
    it("builds INS 0x54 with the supplied P1/P2 framing", () => {
      const apdu = new PcztTransparentOutputCommand({
        data: DATA,
        p1: PCZT_P1.NEXT,
        p2: PCZT_P2.CONTINUE,
      })
        .getApdu()
        .getRawApdu();
      expect(apduHex(apdu)).toBe("e054800002" + "0102");
    });
  });

  describe("PcztOrchardActionCommand", () => {
    it("builds INS 0x56 and can carry the P2_FINISHED marker", () => {
      const apdu = new PcztOrchardActionCommand({
        data: DATA,
        p1: PCZT_P1.LAST,
        p2: PCZT_P2.FINISHED,
      })
        .getApdu()
        .getRawApdu();
      expect(apduHex(apdu)).toBe("e056010102" + "0102");
    });

    it("surfaces a device error status word", () => {
      const result = new PcztOrchardActionCommand({
        data: DATA,
        p1: PCZT_P1.FIRST,
        p2: PCZT_P2.CONTINUE,
      }).parseResponse(rejected);
      expect(isSuccessCommandResult(result)).toBe(false);
    });
  });
});
