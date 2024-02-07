import { Either, Left } from "purify-ts";

import {
  ApiCallError,
  JSONParseError,
  ParseResponseError,
} from "@internal/config/di/configTypes";

import { RemoteConfigDataSource } from "./ConfigDataSource";
import { RestRemoteConfigDataSource } from "./RemoteConfigDataSource";

let datasource: RemoteConfigDataSource;

// Necessary to use `any` on the prototype to be able to spy on private methods
/* eslint-disable @typescript-eslint/no-explicit-any */
const callApiSpy = jest.spyOn(
  RestRemoteConfigDataSource.prototype as any,
  "_callApi"
);
const parseResponseSpy = jest.spyOn(
  RestRemoteConfigDataSource.prototype as any,
  "_parseResponse"
);
/* eslint-enable @typescript-eslint/no-explicit-any */

describe("RemoteRestConfigDataSource", () => {
  describe("RestRemoteConfigDataSource", () => {
    beforeEach(() => {
      callApiSpy.mockClear();
      parseResponseSpy.mockClear();
      datasource = new RestRemoteConfigDataSource();
    });

    it("should return an Either<never, Config>", async () => {
      callApiSpy.mockResolvedValue(
        Either.of({
          ok: true,
          json: () =>
            Promise.resolve(
              Either.of({ name: "DeviceSDK", version: "0.0.0-fake.1" })
            ),
        })
      );

      parseResponseSpy.mockReturnValue(
        Either.of({
          name: "DeviceSDK",
          version: "0.0.0-fake.1",
        })
      );

      expect(await datasource.getConfig()).toStrictEqual(
        Either.of({
          name: "DeviceSDK",
          version: "0.0.0-fake.1",
        })
      );
    });

    it("should return an Either<ApiCallError, never> if _callApi throws", async () => {
      const err = new Error("_callApi error");
      callApiSpy.mockResolvedValue(Left(err));

      expect(await datasource.getConfig()).toStrictEqual(
        Left(new ApiCallError(err))
      );
    });

    it("should return an Either<ApiCallError, never> if _callApi returns a non-ok response", async () => {
      callApiSpy.mockResolvedValue(
        Either.of({
          ok: false,
          json: () =>
            Promise.resolve(
              Either.of({ name: "DeviceSDK", version: "0.0.0-fake.1" })
            ),
        })
      );

      expect(await datasource.getConfig()).toStrictEqual(
        Left(new ApiCallError(new Error("response not ok")))
      );
    });

    it("should return an Either<JSONParseError, never> if deserializing json fails", async () => {
      const err = new Error("deserializing json failure");
      callApiSpy.mockResolvedValue(
        Either.of({
          ok: true,
          json: () => Promise.resolve(Left(err)),
        })
      );

      expect(await datasource.getConfig()).toStrictEqual(
        Left(new JSONParseError())
      );
    });

    it("should return an Either<ParseResponseError, never> if _parseResponse throws", async () => {
      callApiSpy.mockResolvedValue(
        Either.of({
          ok: true,
          json: () =>
            Promise.resolve(
              Either.of({ name: "DeviceSDK", version: "0.0.0-fake.1" })
            ),
        })
      );

      parseResponseSpy.mockImplementation(() => {
        return Left(new ParseResponseError());
      });

      expect(await datasource.getConfig()).toStrictEqual(
        Left(new ParseResponseError())
      );
    });

    it("should return an Either<ParseResponseError, never> if `name` is missing in Dto", async () => {
      parseResponseSpy.mockRestore();
      callApiSpy.mockResolvedValue(
        Either.of({
          ok: true,
          json: () =>
            Promise.resolve(
              Either.of({
                version: "0.0.0-fake.1",
                yolo: "yolo",
              })
            ),
        })
      );

      expect(await datasource.getConfig()).toStrictEqual(
        Left(new ParseResponseError())
      );
    });

    describe("without private methods spy", () => {
      beforeEach(() => {
        callApiSpy.mockRestore();
        parseResponseSpy.mockRestore();
      });

      it("should return an Either<never, Config>", async () => {
        expect(await datasource.getConfig()).toStrictEqual(
          Either.of({
            name: "DeviceSDK",
            version: "0.0.0-fake.1",
          })
        );
      });
    });
  });
});
