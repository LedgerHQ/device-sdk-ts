import { type LogData } from "../logger/types";
import { extractApduExchanges } from "./apduExchanges";

const ascii = (text: string) => Buffer.from(text, "ascii").toString("hex");
const appAndVersion = (name: string) =>
  `01${name.length.toString(16).padStart(2, "0")}${ascii(name)}05${ascii("1.0.0")}9000`;

const exchange = (
  apdu: string,
  response: string,
  sessionId = "s1",
): LogData => ({
  timestamp: "2026-01-01T00:00:00.000Z",
  tag: "[device-session]",
  verbosity: "debug",
  message: "[exchange]",
  payload: { type: "apdu-exchange", sessionId, apdu, response },
  payloadJSON: "{}",
});

const commands = (logs: LogData[]) =>
  extractApduExchanges(logs).map(({ command }) => command);

describe("extractApduExchanges", () => {
  it("names CLA b0 commands whatever app is open", () => {
    expect(
      commands([exchange("b001000000", appAndVersion("Ethereum"))]),
    ).toEqual(["getAppAndVersion"]);
  });

  it("keeps the raw CLA INS until the open app is known", () => {
    expect(commands([exchange("e004000000", "9000")])).toEqual(["e0 04"]);
  });

  it("names a command against the app the device reports", () => {
    expect(
      commands([
        exchange("b001000000", appAndVersion("Ethereum")),
        exchange("e004000000", "9000"),
        exchange("b001000000", appAndVersion("Solana")),
        exchange("e004000000", "9000"),
      ]),
    ).toEqual([
      "getAppAndVersion",
      "signTransaction / startTransaction / storeTransaction",
      "getAppAndVersion",
      "getAppConfiguration",
    ]);
  });

  it("names dashboard commands only on the dashboard", () => {
    expect(
      commands([
        exchange("b001000000", appAndVersion("Ethereum")),
        exchange("e001000000", "6d00"),
        exchange("b0a7000000", "9000"),
        exchange("e001000000", "9000"),
      ]),
    ).toEqual(["getAppAndVersion", "e0 01", "closeApp", "getOsVersion"]);
  });

  it("follows the app OPEN_APP opens", () => {
    expect(
      commands([
        exchange("b001000000", appAndVersion("BOLOS")),
        exchange(`e0d8000006${ascii("Solana")}`, "9000"),
        exchange("e004000000", "9000"),
      ]),
    ).toEqual(["getAppAndVersion", "openApp", "getAppConfiguration"]);
  });

  it("keeps the open app when an exchange fails", () => {
    expect(
      commands([
        exchange("b001000000", appAndVersion("BOLOS")),
        exchange(`e0d8000006${ascii("Solana")}`, "6807"),
        exchange("e001000000", "9000"),
      ]),
    ).toEqual(["getAppAndVersion", "openApp", "getOsVersion"]);
  });

  it("tags each exchange with the layer that answers it", () => {
    expect(
      extractApduExchanges([
        exchange("e004000000", "6d00"),
        exchange("b001000000", appAndVersion("BOLOS")),
        exchange(`e0d8000008${ascii("Ethereum")}`, "9000"),
        exchange("e004000000", "9000"),
        exchange("b0a7000000", "9000"),
      ]).map(({ layer }) => layer),
    ).toEqual([undefined, "OS", "OS", "Ethereum", "OS"]);
  });

  it("tracks the open app per session", () => {
    expect(
      commands([
        exchange("b001000000", appAndVersion("Ethereum"), "s1"),
        exchange("b001000000", appAndVersion("Solana"), "s2"),
        exchange("e004000000", "9000", "s1"),
        exchange("e004000000", "9000", "s2"),
      ]).slice(2),
    ).toEqual([
      "signTransaction / startTransaction / storeTransaction",
      "getAppConfiguration",
    ]);
  });
});
