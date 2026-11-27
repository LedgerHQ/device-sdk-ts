import { spawn } from "node:child_process";
import path from "node:path";

import {
  type DeviceConfig,
  MockClient,
  type MockConfig,
} from "@ledgerhq/device-mockserver-client";
import { afterAll, beforeAll, describe, it } from "vitest";

const MOCK_SERVER_URL =
  process.env["MOCK_SERVER_URL"] ?? "http://localhost:9752";
const MAESTRO = process.env["MAESTRO_BIN"] ?? "maestro";
const FLOWS_DIR = path.join(__dirname, "flows");

const DEVICE_NAME = "E2E Stax";
const STAX_WITH_ETH: DeviceConfig = {
  name: DEVICE_NAME,
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.9.1",
  apps: [
    { name: "BOLOS", version: "1.9.1" },
    { name: "Ethereum", version: "1.22.0" },
  ],
  masks: [0x33200000],
};

// The native transfer of the sample's Playwright sign-transaction spec, as its
// unsigned serialization.
const NATIVE_TRANSFER =
  "0xeb808504a817c80082520894123456789012345678901234567890123456789087038d7ea4c6800080018080";
const ADDRESS = "0x47609D32EdF0C2A046D8D1D22680A2F93c78661b";
const SIGNATURE = {
  r: "0xe1efe34a50d21592aded657578cd13b2633f4e6d4c9a69c87beb8b7b9f0b4c28",
  s: "0x16a21f4f34dfa3cfec9de28758b6d73361218eb6d1d5b759d445e05d59afa44c",
};

// Recorded from the Ethereum app 1.22.0 on Speculos with the default test seed,
// so the app answers without an emulator.
const ETHEREUM_APP_MOCKS: MockConfig[] = [
  // GetAppAndVersion: Ethereum 1.22.0 is open
  {
    prefix: "b001000000",
    response: "0108457468657265756d06312e32322e3001009000",
  },
  // GetAppConfiguration
  { prefix: "e006000000", response: "030116009000" },
  // Web3 Checks opt-in
  { prefix: "e032010000", response: "009000" },
  // GetChallenge
  { prefix: "e020000000", response: "4cb35c969000" },
  // GetAddress 44'/60'/0'/0/0
  {
    prefix: "e002000015058000002c8000003c800000000000000000000000",
    response:
      "410432c3487e2e13594c31110b3489d1d1c364efccdb4f33da5cd8b8bc59d156d754547afcec300ead313eb7db6368aee6778b97b46ece9da5bf914fa647ae501c1128343736303944333245644630433241303436443844314432323638304132463933633738363631629000",
  },
  // SignTransaction of NATIVE_TRANSFER with 44'/60'/0'/0/0
  {
    prefix:
      "e004000041058000002c8000003c800000000000000000000000eb808504a817c80082520894123456789012345678901234567890123456789087038d7ea4c6800080018080",
    response:
      "26e1efe34a50d21592aded657578cd13b2633f4e6d4c9a69c87beb8b7b9f0b4c2816a21f4f34dfa3cfec9de28758b6d73361218eb6d1d5b759d445e05d59afa44c9000",
  },
];

const runFlow = (flow: string, env: Record<string, string> = {}) =>
  new Promise<void>((resolve, reject) => {
    const args = ["test", path.join(FLOWS_DIR, `${flow}.yaml`)];
    for (const [key, value] of Object.entries(env)) {
      args.push("-e", `${key}=${value}`);
    }
    const maestro = spawn(MAESTRO, args, {
      stdio: "inherit",
      timeout: 300_000,
    });
    maestro.on("error", reject);
    maestro.on("exit", code =>
      code === 0
        ? resolve()
        : reject(new Error(`Maestro flow ${flow} failed (exit ${code})`)),
    );
  });

describe("mobile: Ethereum sign transaction", () => {
  const client = new MockClient(MOCK_SERVER_URL);

  beforeAll(async () => {
    const token = await client.authenticate();
    const device = await client.addDevice(STAX_WITH_ETH);
    for (const mock of ETHEREUM_APP_MOCKS) {
      await client.addMock(device.id, mock);
    }
    await runFlow("connect-and-get-address", {
      MOCK_SERVER_URL,
      TOKEN: token,
      DEVICE_NAME,
      ADDRESS,
    });
  });

  afterAll(async () => {
    await client.disposeSession();
  });

  it("signs a native transfer", async () => {
    await runFlow("sign-transaction", { TRANSACTION: NATIVE_TRANSFER });
    await runFlow("assert-signature", { R: SIGNATURE.r, S: SIGNATURE.s });
  });
});
