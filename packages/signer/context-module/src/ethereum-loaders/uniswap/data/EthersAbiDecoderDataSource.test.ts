import { EthersAbiDecoderDataSource } from "./EthersAbiDecoderDataSource";

describe("EthersAbiDecoderDataSource", () => {
  let decoder: EthersAbiDecoderDataSource;

  beforeEach(() => {
    decoder = new EthersAbiDecoderDataSource();
  });

  it("should correctly decode valid ABI data", () => {
    const types = ["uint256", "address"];
    const data =
      "0x" +
      "000000000000000000000000000000000000000000000000000000000000000a" + // 10 as uint256
      "00000000000000000000000027213e28d7fda5c57fe9e5dd923818dbccf71c47"; // Address

    const result = decoder.decode(types, data);
    expect(result[0]).toEqual(10n);
    expect(result[1]).toEqual("0x27213E28D7fDA5c57Fe9e5dD923818DBCcf71c47");
  });

  it("should return an empty array on decode failure", () => {
    const types = ["uint256"];
    const invalidData = "0x1234"; // Invalid encoded data

    const result = decoder.decode(types, invalidData);
    expect(result).toEqual([]);
  });
});
