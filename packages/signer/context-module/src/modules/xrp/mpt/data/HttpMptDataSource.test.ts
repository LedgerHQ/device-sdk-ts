import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { HttpMptDataSource } from "./HttpMptDataSource";

// LIQUCF, as CAL serves it.
const ISSUANCE_ID = "06361CB09DBAF9976AB0CFB549A54DC608D1C0DF0AD59EC7";
const DATA =
  "010190020101030480000090040358525005064c4951554346060102071a101806361cb09dbaf9976ab0cfb549a54dc608d1c0df0ad59ec7";
const PROD_SIGNATURE =
  "3045022100e245db612050f5e1e73266be703b469757868236bcb976c5b0a154ead50ca330022005764df82711dc22a49965aa8eed4c68863c694bd0f66727ce2d8cc261006acc";
const TEST_SIGNATURE =
  "304402200debc0857130be224e8b9527d6a32bfdd6b03f0c29fe0abc5e7e2230962adfa1022063028feadadb79ae144607d5a43bea52073e81f181b91c3b01a3ef49e13d65dc";

describe("HttpMptDataSource", () => {
  let httpMock: { get: ReturnType<typeof vi.fn> };

  const makeDataSource = (mode: "prod" | "test") =>
    new HttpMptDataSource(
      {
        cal: {
          url: "https://crypto-assets-service.api.ledger.com/v1",
          mode,
          branch: "main",
        },
      } as ContextModuleServiceConfig,
      httpMock as unknown as DmkNetworkClient,
    );

  const response = [
    {
      id: "ripple/mpt/06361cb09dbaf9976ab0cfb549a54dc608d1c0df0ad59ec7:reprn4dbxvhnbdjghqwuf92nzlu3murfc3",
      descriptor: {
        data: DATA,
        descriptorType: "token",
        signatures: { prod: PROD_SIGNATURE, test: TEST_SIGNATURE },
      },
    },
  ];

  const noDescriptor = Left(
    new Error(
      `[ContextModule] HttpMptDataSource: no MPT descriptor for issuance id ${ISSUANCE_ID}`,
    ),
  );

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
  });

  it("should query CAL by the uppercase issuance id", async () => {
    httpMock.get.mockResolvedValue([]);

    await makeDataSource("prod").getMptDescriptor({
      issuanceId: ISSUANCE_ID.toLowerCase(),
    });

    expect(httpMock.get).toHaveBeenCalledWith(
      "https://crypto-assets-service.api.ledger.com/v1/tokens",
      {
        params: {
          network_family: "ripple",
          token_identifier: ISSUANCE_ID,
          output: "id,descriptor",
          ref: "branch:main",
        },
      },
    );
  });

  it.each([
    ["prod", `${DATA}0847${PROD_SIGNATURE}`],
    ["test", `${DATA}0846${TEST_SIGNATURE}`],
  ] as const)(
    "should append the %s signature with tag 08",
    async (mode, descriptor) => {
      httpMock.get.mockResolvedValue(response);

      const result = await makeDataSource(mode).getMptDescriptor({
        issuanceId: ISSUANCE_ID,
      });

      expect(result).toEqual(Right(descriptor));
    },
  );

  it.each([
    ["no token matches", []],
    ["the response is not a list", { descriptor: {} }],
    ["an entry carries no descriptor", [{ id: "ripple/mpt/x" }]],
    [
      "the descriptor data is empty",
      [{ descriptor: { data: "", signatures: { prod: "sig", test: "sig" } } }],
    ],
    [
      "a signature is missing",
      [{ descriptor: { data: DATA, signatures: { test: TEST_SIGNATURE } } }],
    ],
  ])("should return an error when %s", async (_case, payload) => {
    httpMock.get.mockResolvedValue(payload);

    const result = await makeDataSource("prod").getMptDescriptor({
      issuanceId: ISSUANCE_ID,
    });

    expect(result).toEqual(noDescriptor);
  });

  it("should return an error when the request fails", async () => {
    httpMock.get.mockRejectedValue(new Error("network"));

    const result = await makeDataSource("prod").getMptDescriptor({
      issuanceId: ISSUANCE_ID,
    });

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpMptDataSource: Failed to fetch the MPT descriptor",
        ),
      ),
    );
  });
});
