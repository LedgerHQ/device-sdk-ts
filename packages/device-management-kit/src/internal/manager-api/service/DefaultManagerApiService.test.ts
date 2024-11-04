import { Left, Right } from "purify-ts";

import { getOsVersionCommandResponseStubBuilder } from "@api/command/os/__mocks__/GetOsVersionCommand";
import { DeviceModelId } from "@api/device/DeviceModel";
import {
  BTC_APP,
  BTC_APP_METADATA,
  ETH_APP,
  ETH_APP_METADATA,
} from "@api/device-action/__test-utils__/data";
import {
  DEFAULT_MANAGER_API_BASE_URL,
  DEFAULT_MOCK_SERVER_BASE_URL,
} from "@internal/manager-api//model/Const";
import { deviceVersionMockBuilder } from "@internal/manager-api/data/__mocks__/GetDeviceVersion";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { HttpFetchApiError } from "@internal/manager-api/model/Errors";

import { DefaultManagerApiService } from "./DefaultManagerApiService";
import { type ManagerApiService } from "./ManagerApiService";

jest.mock("@internal/manager-api/data/AxiosManagerApiDataSource");
let dataSource: jest.Mocked<AxiosManagerApiDataSource>;
let service: ManagerApiService;
describe("ManagerApiService", () => {
  beforeEach(() => {
    dataSource = new AxiosManagerApiDataSource({
      managerApiUrl: DEFAULT_MANAGER_API_BASE_URL,
      mockUrl: DEFAULT_MOCK_SERVER_BASE_URL,
    }) as jest.Mocked<AxiosManagerApiDataSource>;
    service = new DefaultManagerApiService(dataSource);
  });

  describe("getAppsByHash", () => {
    describe("success cases", () => {
      it("with no apps, should return an empty list", async () => {
        dataSource.getAppsByHash.mockResolvedValue(Right([]));
        expect(await service.getAppsByHash([])).toEqual(Right([]));
      });

      it("with one app, should return the metadata", async () => {
        dataSource.getAppsByHash.mockResolvedValue(Right([BTC_APP_METADATA]));
        expect(await service.getAppsByHash([BTC_APP])).toEqual(
          Right([BTC_APP_METADATA]),
        );
      });

      it("with two app, should return the metadata of both apps", async () => {
        dataSource.getAppsByHash.mockResolvedValue(
          Right([BTC_APP_METADATA, ETH_APP_METADATA]),
        );
        expect(await service.getAppsByHash([BTC_APP, ETH_APP])).toEqual(
          Right([BTC_APP_METADATA, ETH_APP_METADATA]),
        );
      });

      it("with one app and one without `appFullHash`, should return the metadata of the correct app", async () => {
        dataSource.getAppsByHash.mockResolvedValue(Right([BTC_APP_METADATA]));
        const APP_WITH_NO_HASH = { ...ETH_APP, appFullHash: "" };
        expect(
          await service.getAppsByHash([BTC_APP, APP_WITH_NO_HASH]),
        ).toEqual(Right([BTC_APP_METADATA]));
      });
    });

    describe("error cases", () => {
      it("should return an error when the data source fails with a known error", async () => {
        const error = new HttpFetchApiError(new Error("Failed to fetch data"));
        dataSource.getAppsByHash.mockRejectedValue(error);
        expect(await service.getAppsByHash([BTC_APP])).toEqual(Left(error));
      });

      it("should return an error when the data source fails with an unknown error", async () => {
        const error = new Error("unkown error");
        dataSource.getAppsByHash.mockRejectedValue(error);
        expect(await service.getAppsByHash([BTC_APP])).toEqual(
          Left(new HttpFetchApiError(error)),
        );
      });
    });
  });

  describe("getDeviceVersion", () => {
    it("should call api with the correct parameters", () => {
      // given
      const deviceInfo = getOsVersionCommandResponseStubBuilder(
        DeviceModelId.STAX,
      );
      const provider = 42;
      // when
      service.getDeviceVersion(deviceInfo, provider);
      // then
      expect(dataSource.getDeviceVersion).toHaveBeenCalledWith("857735172", 42);
    });
  });
  describe("getFirmwareVersion", () => {
    it("should call api with the correct parameters", () => {
      // given
      const deviceVersion = deviceVersionMockBuilder();
      const deviceInfo = getOsVersionCommandResponseStubBuilder(
        DeviceModelId.STAX,
      );
      const provider = 42;
      // when
      service.getFirmwareVersion(deviceInfo, deviceVersion, provider);
      // then
      expect(dataSource.getFirmwareVersion).toHaveBeenCalledWith(
        "1.3.0",
        17,
        42,
      );
    });
  });
});
