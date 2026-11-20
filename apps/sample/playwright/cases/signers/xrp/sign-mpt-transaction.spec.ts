/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

// First Stax combo carrying XRP 2.9.0, the first app version with MPTs.
const STAX_WITH_XRP_MPT: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.11.0",
  apps: [
    { name: "BOLOS", version: "1.11.0" },
    { name: "XRP", version: "2.9.0" },
  ],
  masks: [0x33200000],
};

// Last Stax combo before MPT support.
const STAX_WITH_XRP_BEFORE_MPT: DeviceConfig = {
  ...STAX_WITH_XRP_MPT,
  firmware_version: "1.10.1",
  apps: [
    { name: "BOLOS", version: "1.10.1" },
    { name: "XRP", version: "2.7.0" },
  ],
};

// The blind signing toggle on the XRP app settings page, on Stax.
const XRP_BLIND_SIGNING_TOGGLE = { x: 88, y: 20 } as const;

// USDX of the XRP app MPT spec: no CAL row.
const UNLISTED_ISSUANCE_ID = "000000050511E17DB83BB6F113939D67BC8EA539EDC926FC";
// LIQUCF and tBRL, both with AssetScale 2.
const LIQUCF_ISSUANCE_ID = "06361CB09DBAF9976AB0CFB549A54DC608D1C0DF0AD59EC7";
const TBRL_ISSUANCE_ID = "063F0B532C28B1B9B5305AB5316904C14A5BB2DA09B430FE";

// The account, key and destination of sign-transaction.spec.ts.
const SEQUENCE = "2400000002";
const FEE = "68400000000000000C";
const SIGNING_PUB_KEY =
  "73210324E5F600B52BB3D9246D49C4AB1722BA7F32B7A3E4F9F2B8A1A28B9118CC36C4";
const ACCOUNT = "8114784051E8B60F89B51417D1D10AE5B7D8EEAF6CDF";
const OTHER_ACCOUNT_ID = "B5F762798A53D543A014CAF8B297CFF8F2F937E8";
const DESTINATION = `8314${OTHER_ACCOUNT_ID}`;
const HOLDER = `8B14${OTHER_ACCOUNT_ID}`;

const mptAmount = (value: string, issuanceId: string) =>
  `60${value}${issuanceId}`;
const issuanceIdField = (issuanceId: string) => `0115${issuanceId}`;

// 1234 units of LIQUCF.
const PAYMENT = [
  "120000",
  SEQUENCE,
  `61${mptAmount("00000000000004D2", LIQUCF_ISSUANCE_ID)}`,
  FEE,
  SIGNING_PUB_KEY,
  ACCOUNT,
  DESTINATION,
].join("");
// 1234 units of LIQUCF, paid with at most 5678 units of tBRL.
const PAYMENT_WITH_TWO_MPTS = [
  "120000",
  SEQUENCE,
  `61${mptAmount("00000000000004D2", LIQUCF_ISSUANCE_ID)}`,
  FEE,
  `69${mptAmount("000000000000162E", TBRL_ISSUANCE_ID)}`,
  SIGNING_PUB_KEY,
  ACCOUNT,
  DESTINATION,
].join("");
const CLAWBACK = [
  "12001E",
  SEQUENCE,
  `61${mptAmount("00000000000004D2", LIQUCF_ISSUANCE_ID)}`,
  FEE,
  SIGNING_PUB_KEY,
  ACCOUNT,
  HOLDER,
].join("");
const authorize = (issuanceId: string) =>
  [
    "120039",
    SEQUENCE,
    FEE,
    SIGNING_PUB_KEY,
    ACCOUNT,
    issuanceIdField(issuanceId),
  ].join("");
const ISSUANCE_LOCK = [
  "120038",
  "2200000001",
  SEQUENCE,
  FEE,
  SIGNING_PUB_KEY,
  ACCOUNT,
  HOLDER,
  issuanceIdField(LIQUCF_ISSUANCE_ID),
].join("");
const ISSUANCE_DESTROY = [
  "120037",
  SEQUENCE,
  FEE,
  SIGNING_PUB_KEY,
  ACCOUNT,
  issuanceIdField(LIQUCF_ISSUANCE_ID),
].join("");

// DER: a SEQUENCE (0x30) whose first element is an INTEGER (0x02).
const DER_SIGNATURE_RE = /^0x30[0-9a-f]{2}02[0-9a-f]+$/i;

const CLEAR_SIGNED_CASES = [
  {
    name: "an MPT Payment",
    transaction: PAYMENT,
    review: ["Amount LIQUCF 12.34"],
  },
  {
    name: "a Payment between two MPTs",
    transaction: PAYMENT_WITH_TWO_MPTS,
    review: ["Amount LIQUCF 12.34", "Send Max tBRL 56.78"],
  },
  {
    name: "an MPT Clawback",
    transaction: CLAWBACK,
    review: ["Transaction Type Clawback", "Amount LIQUCF 12.34"],
  },
  {
    name: "an MPTokenAuthorize",
    transaction: authorize(LIQUCF_ISSUANCE_ID),
    review: ["Token LIQUCF"],
  },
  {
    name: "an MPTokenIssuanceSet",
    transaction: ISSUANCE_LOCK,
    review: ["Flags Lock", "Token LIQUCF"],
  },
  {
    name: "an MPTokenIssuanceDestroy",
    transaction: ISSUANCE_DESTROY,
    review: ["Token LIQUCF"],
  },
];

test.describe("signer xrp: sign MPT transaction", { tag: "@speculos" }, () => {
  test("signs an MPTokenAuthorize CAL has no descriptor for, without the ticker", async ({
    device,
    xrpSigner,
    speculos,
  }) => {
    test.setTimeout(180_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    let screens: string[] = [];

    await test.step("Given a connected Stax with XRP 2.9.0", async () => {
      dev = await device.addAndConnect(STAX_WITH_XRP_MPT);
    });

    await test.step("When an MPTokenAuthorize of an MPT unknown to CAL is submitted", async () => {
      await xrpSigner.open();
      await xrpSigner.signTransaction(authorize(UNLISTED_ISSUANCE_ID));
    });

    await test.step("And the transaction is approved on the Speculos screen", async () => {
      const emulator = speculos(dev);
      await emulator.waitReady();
      screens = await emulator.approveSigning();
    });

    await test.step("Then the issuance id is shown without a token and a signature is returned", async () => {
      const result = await xrpSigner.lastResult<string>({ timeout: 150_000 });

      expect(result.status).toBe("completed");
      expect(result.output).toMatch(DER_SIGNATURE_RE);
      const review = screens.join(" ");
      // With a descriptor, a "Token" line sits between the fee and the ID.
      expect(review).toContain("Fee XRP 0.000012 Issuance ID");
      expect(review.replace(/\s/g, "")).toContain(
        UNLISTED_ISSUANCE_ID.toLowerCase(),
      );
    });
  });

  test("sends a Payment between two MPTs to XRP 2.7.0, which cannot parse it", async ({
    device,
    xrpSigner,
  }) => {
    test.setTimeout(180_000);

    await test.step("Given a connected Stax with XRP 2.7.0", async () => {
      await device.addAndConnect(STAX_WITH_XRP_BEFORE_MPT);
    });

    await test.step("When a Payment between two MPTs is submitted for signing", async () => {
      await xrpSigner.open();
      await xrpSigner.signTransaction(PAYMENT_WITH_TWO_MPTS);
    });

    await test.step("Then the app refuses it", async () => {
      const error = await xrpSigner.lastError({ timeout: 150_000 });

      expect(error).toContain("UnknownDeviceExchangeError");
      expect(error).toContain("errorCode: '680b'");
    });
  });

  test("still sends a Payment between two MPTs to XRP 2.7.0 with blind signing enabled, which cannot parse it", async ({
    device,
    xrpSigner,
    speculos,
  }) => {
    test.setTimeout(180_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;

    await test.step("Given a connected Stax with XRP 2.7.0", async () => {
      dev = await device.addAndConnect(STAX_WITH_XRP_BEFORE_MPT);
    });

    await test.step("And blind signing is enabled on the device", async () => {
      // Get address opens the XRP app, so its settings can be reached.
      await xrpSigner.open();
      await xrpSigner.getAddress();
      await xrpSigner.lastResult();
      const emulator = speculos(dev);
      await emulator.waitReady();
      await emulator.enableBlindSigning(XRP_BLIND_SIGNING_TOGGLE);
    });

    await test.step("When a Payment between two MPTs is submitted for signing", async () => {
      await xrpSigner.open();
      await xrpSigner.signTransaction(PAYMENT_WITH_TWO_MPTS);
    });

    // The app offers blind signing only for a transaction it parses.
    await test.step("Then the app still refuses it", async () => {
      const error = await xrpSigner.lastError({ timeout: 150_000 });

      expect(error).toContain("UnknownDeviceExchangeError");
      expect(error).toContain("errorCode: '680b'");
    });
  });

  for (const { name, transaction, review } of CLEAR_SIGNED_CASES) {
    test(`clear signs ${name} with the descriptors from CAL`, async ({
      device,
      xrpSigner,
      speculos,
    }) => {
      test.setTimeout(180_000);

      let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
      let screens: string[] = [];

      await test.step("Given a connected Stax with XRP 2.9.0", async () => {
        dev = await device.addAndConnect(STAX_WITH_XRP_MPT);
      });

      await test.step(`When ${name} is submitted for signing`, async () => {
        await xrpSigner.open();
        await xrpSigner.signTransaction(transaction);
      });

      await test.step("And the transaction is approved on the Speculos screen", async () => {
        const emulator = speculos(dev);
        await emulator.waitReady();
        screens = await emulator.approveSigning();
      });

      await test.step("Then the review shows the tickers and a signature is returned", async () => {
        const result = await xrpSigner.lastResult<string>({ timeout: 150_000 });

        expect(result.status).toBe("completed");
        expect(result.output).toMatch(DER_SIGNATURE_RE);
        for (const text of review) {
          expect(screens.join(" ")).toContain(text);
        }
      });
    });
  }
});
