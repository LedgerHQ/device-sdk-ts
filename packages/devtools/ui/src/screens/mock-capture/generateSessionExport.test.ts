import { describe, expect, it } from "vitest";

import { type ApduExchange } from "../../hooks/useConnectorMessages";
import {
  generateMultiDeviceSessionExport,
  generateSessionExport,
} from "./generateSessionExport";

const exchange = (apdu: string, response: string): ApduExchange => ({
  apdu,
  response,
  sessionId: "session-1",
  timestamp: "2026-06-29T00:00:00.000Z",
});

describe("generateSessionExport", () => {
  it("creates one mock per unique APDU with the full APDU as prefix", () => {
    const result = generateSessionExport([
      exchange("e004000005", "deadbeef9000"),
      exchange("e006000000", "9000"),
    ]);

    expect(result.devices).toHaveLength(1);
    expect(result.devices[0]?.mocks).toEqual([
      { prefix: "e004000005", responses: ["deadbeef9000"] },
      { prefix: "e006000000", responses: ["9000"] },
    ]);
  });

  it("accumulates differing responses for the same APDU in order", () => {
    const result = generateSessionExport([
      exchange("e004000000", "aa9000"),
      exchange("e004000000", "6985"),
      exchange("e004000000", "bb9000"),
    ]);

    expect(result.devices[0]?.mocks).toEqual([
      { prefix: "e004000000", responses: ["aa9000", "6985", "bb9000"] },
    ]);
  });

  it("collapses identical repeated responses to a single entry", () => {
    const result = generateSessionExport([
      exchange("e004000000", "aa9000"),
      exchange("e004000000", "aa9000"),
    ]);

    expect(result.devices[0]?.mocks).toEqual([
      { prefix: "e004000000", responses: ["aa9000"] },
    ]);
  });

  it("lowercases prefixes and responses", () => {
    const result = generateSessionExport([exchange("E004000000", "AA9000")]);

    expect(result.devices[0]?.mocks).toEqual([
      { prefix: "e004000000", responses: ["aa9000"] },
    ]);
  });

  it("skips handshake APDUs by default", () => {
    const result = generateSessionExport([
      exchange("e001000000", "33000004deadbeef9000"),
      exchange("b001000000", "0105424f4c4f539000"),
      exchange("e004000000", "aa9000"),
    ]);

    expect(result.devices[0]?.mocks).toEqual([
      { prefix: "e004000000", responses: ["aa9000"] },
    ]);
  });

  it("includes handshake APDUs when requested", () => {
    const result = generateSessionExport(
      [
        exchange("e001000000", "33000004deadbeef9000"),
        exchange("e004000000", "aa9000"),
      ],
      {},
      { includeHandshake: true },
    );

    expect(result.devices[0]?.mocks).toHaveLength(2);
  });

  it("attaches the provided device metadata", () => {
    const result = generateSessionExport([exchange("e004000000", "aa9000")], {
      name: "Captured Device",
      device_type: "nanoX",
      firmware_version: "2.2.3",
    });

    expect(result.devices[0]).toMatchObject({
      name: "Captured Device",
      device_type: "nanoX",
      firmware_version: "2.2.3",
    });
  });

  it("places name as the first key of the device", () => {
    const result = generateSessionExport([exchange("e004000000", "aa9000")], {
      device_type: "nanoX",
      firmware_version: "2.2.3",
      name: "Captured Device",
    });

    expect(Object.keys(result.devices[0]!)[0]).toBe("name");
  });

  it("produces an empty mocks list when there are no exchanges", () => {
    const result = generateSessionExport([]);

    expect(result.devices[0]?.mocks).toEqual([]);
  });
});

describe("generateMultiDeviceSessionExport", () => {
  it("keeps one device entry per group with its own mocks", () => {
    const result = generateMultiDeviceSessionExport([
      {
        device: { name: "Device A", device_type: "flex" },
        exchanges: [exchange("e004000000", "aa9000")],
      },
      {
        device: { name: "Device B", device_type: "stax" },
        exchanges: [exchange("e006000000", "bb9000")],
      },
    ]);

    expect(result.devices).toHaveLength(2);
    expect(result.devices[0]).toMatchObject({
      name: "Device A",
      device_type: "flex",
      mocks: [{ prefix: "e004000000", responses: ["aa9000"] }],
    });
    expect(result.devices[1]).toMatchObject({
      name: "Device B",
      device_type: "stax",
      mocks: [{ prefix: "e006000000", responses: ["bb9000"] }],
    });
  });

  it("does not merge mocks across devices", () => {
    const result = generateMultiDeviceSessionExport([
      { device: { name: "A" }, exchanges: [exchange("e004000000", "aa9000")] },
      { device: { name: "B" }, exchanges: [exchange("e004000000", "bb9000")] },
    ]);

    expect(result.devices[0]?.mocks).toEqual([
      { prefix: "e004000000", responses: ["aa9000"] },
    ]);
    expect(result.devices[1]?.mocks).toEqual([
      { prefix: "e004000000", responses: ["bb9000"] },
    ]);
  });
});
