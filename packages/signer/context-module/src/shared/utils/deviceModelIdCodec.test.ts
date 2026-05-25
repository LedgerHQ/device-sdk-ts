import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Right } from "purify-ts";

import { deviceModelIdCodec } from "./deviceModelIdCodec";

describe("deviceModelIdCodec", () => {
  it.each([
    DeviceModelId.NANO_X,
    DeviceModelId.NANO_SP,
    DeviceModelId.STAX,
    DeviceModelId.FLEX,
  ])("decodes %s as Right", (model) => {
    expect(deviceModelIdCodec.decode(model)).toEqual(Right(model));
  });

  it("rejects NANO_S (unsupported for clear-signing)", () => {
    expect(deviceModelIdCodec.decode(DeviceModelId.NANO_S).isLeft()).toBe(true);
  });

  it.each([null, undefined, "", "ledger", 42, {}, []])(
    "rejects non-model values: %s",
    (value) => {
      expect(deviceModelIdCodec.decode(value).isLeft()).toBe(true);
    },
  );

  it("encodes a model as itself", () => {
    expect(deviceModelIdCodec.encode(DeviceModelId.NANO_X)).toBe(
      DeviceModelId.NANO_X,
    );
  });
});
