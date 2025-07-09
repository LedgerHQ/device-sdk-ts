import { Just, Left, Nothing, Right } from "purify-ts";

import { LKRPHttpRequestError } from "@api/app-binder/Errors";
import { LKRPBlock } from "@internal/utils/LKRPBlock";
import { LKRPBlockStream } from "@internal/utils/LKRPBlockStream";

import { HttpLKRPDataSource } from "./HttpLKRPDataSource";

const mockJwt = {
  access_token: "ACCESS TOKEN",
  permissions: { TRUSTCHAIN_ID: { "m/": ["owner"] } },
};

const mockChallengeJSON = {
  version: 0,
  challenge: {
    data: "1010101010010101010",
    expiry: "2025-06-30T10:00:00Z",
  },
  host: "example.com",
  rp: [
    {
      credential: {
        version: 0,
        curveId: 33,
        signAlgorithm: 1,
        publicKey: "aaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      signature: "abababababababab",
    },
  ],
  protocolVersion: { major: 1, minor: 0, patch: 0 },
};

const mockSignature = {
  credential: {
    version: 0,
    curveId: 33,
    signAlgorithm: 1,
    publicKey: "bbbbbbbbbbbbbbbbbbbbbbbbbbb",
  },
  signature: "acacacacacacacac",
  attestation: "0000000000000000",
};

describe("HttpLKRPDataSource", () => {
  const fetchSpy = vi.spyOn(global, "fetch");
  const baseUrl = "https://example.com";

  afterEach(() => {
    fetchSpy.mockClear();
  });

  describe("getChallenge", () => {
    it("should fetch challenge successfully", async () => {
      // GIVEN
      const mockChallenge = {
        tlv: "0f1234567890",
        json: mockChallengeJSON,
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChallenge),
      } as Response);

      // WHEN
      const dataSource = new HttpLKRPDataSource(baseUrl);
      const result = await dataSource.getChallenge();
      expect(fetchSpy).toHaveBeenCalledWith(`${baseUrl}/challenge`, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      // THEN
      expect(result).toEqual(Right(mockChallenge));
    });

    it("should handle fetch error", async () => {
      // GIVEN
      const error = new Error("Random error");
      fetchSpy.mockRejectedValueOnce(error);

      // WHEN
      const dataSource = new HttpLKRPDataSource(baseUrl);
      const result = await dataSource.getChallenge();

      // THEN
      expect(result).toEqual(Left(new LKRPHttpRequestError(error)));
    });
  });

  describe("authenticate", () => {
    it("should fetch a JWT when the authentication is successful", async () => {
      // GIVEN
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockJwt),
      } as Response);

      // WHEN
      const dataSource = new HttpLKRPDataSource(baseUrl);
      const result = await dataSource.authenticate({
        challenge: mockChallengeJSON,
        signature: mockSignature,
      });

      // THEN
      expect(fetchSpy).toHaveBeenCalledWith(`${baseUrl}/authenticate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challenge: mockChallengeJSON,
          signature: mockSignature,
        }),
      });
      expect(result).toEqual(
        Right({ jwt: mockJwt, trustchainId: Just("TRUSTCHAIN_ID") }),
      );
    });

    it("should return no trustchainId the returned JWT does not contain one", async () => {
      // GIVEN
      const jwtWithoutTrustchainId = {
        access_token: "ACCESS TOKEN",
        permissions: {},
      };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(jwtWithoutTrustchainId),
      } as Response);

      // WHEN
      const dataSource = new HttpLKRPDataSource(baseUrl);
      const result = await dataSource.authenticate({
        challenge: mockChallengeJSON,
        signature: mockSignature,
      });

      // THEN
      expect(result).toEqual(
        Right({ jwt: jwtWithoutTrustchainId, trustchainId: Nothing }),
      );
    });

    it("should handle authentication error", async () => {
      // GIVEN
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as Response);

      // WHEN
      const dataSource = new HttpLKRPDataSource(baseUrl);
      const result = await dataSource.authenticate({
        challenge: mockChallengeJSON,
        signature: mockSignature,
      });

      // THEN
      expect(result).toEqual(
        Left(
          new LKRPHttpRequestError(
            `Failed to fetch ${baseUrl}/authenticate: [401] Unauthorized`,
          ),
        ),
      );
    });
  });

  describe("getTrustchainById", () => {
    it("should fetch trustchain by ID successfully", async () => {
      // GIVEN
      const mockTrustchain = {
        "m/": "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1e1d",
        "m/16'": "1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b",
      };
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTrustchain),
      } as Response);

      // WHEN
      const dataSource = new HttpLKRPDataSource(baseUrl);
      const result = await dataSource.getTrustchainById(
        "TRUSTCHAIN_ID",
        mockJwt,
      );

      // THEN
      expect(fetchSpy).toHaveBeenCalledWith(
        `${baseUrl}/trustchain/TRUSTCHAIN_ID`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockJwt.access_token}`,
          },
        },
      );
      expect(result).toEqual(
        Right({
          "m/": LKRPBlockStream.fromHex(
            "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1e1d",
          ),
          "m/16'": LKRPBlockStream.fromHex(
            "1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b",
          ),
        }),
      );
    });

    it("should handle errors", async () => {
      // GIVEN
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response);

      // WHEN
      const dataSource = new HttpLKRPDataSource(baseUrl);
      const result = await dataSource.getTrustchainById(
        "TRUSTCHAIN_ID",
        mockJwt,
      );

      // THEN
      expect(result).toEqual(
        Left(
          new LKRPHttpRequestError(
            `Failed to fetch ${baseUrl}/trustchain/TRUSTCHAIN_ID: [500] Internal Server Error`,
          ),
        ),
      );
    });
  });

  describe("postDerivation", () => {
    it("should post derivation successfully", async () => {
      // GIVEN
      const hex = "0102030405060708090a0b0c0d0e0f";
      const mockStream = LKRPBlockStream.fromHex(hex);
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      // WHEN
      const dataSource = new HttpLKRPDataSource(baseUrl);
      const result = await dataSource.postDerivation(
        "TRUSTCHAIN_ID",
        mockStream,
        mockJwt,
      );

      // THEN
      expect(fetchSpy).toHaveBeenCalledWith(
        `${baseUrl}/trustchain/TRUSTCHAIN_ID/derivation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockJwt.access_token}`,
          },
          body: JSON.stringify(hex),
        },
      );
      expect(result).toEqual(Right(undefined));
    });
  });

  describe("putCommands", () => {
    it("should put commands successfully", async () => {
      // GIVEN
      const hex = "0102030405060708090a0b0c0d0e0f";
      const mockBlock = LKRPBlock.fromHex(hex);
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      // WHEN
      const dataSource = new HttpLKRPDataSource(baseUrl);
      const result = await dataSource.putCommands(
        "TRUSTCHAIN_ID",
        "m/0'/16'/0'",
        mockBlock,
        mockJwt,
      );

      // THEN
      expect(fetchSpy).toHaveBeenCalledWith(
        `${baseUrl}/trustchain/TRUSTCHAIN_ID/commands`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mockJwt.access_token}`,
          },
          body: JSON.stringify({ path: "m/0'/16'/0'", blocks: [hex] }),
        },
      );
      expect(result).toEqual(Right(undefined));
    });
  });
});
