import { Left, Right } from "purify-ts";
import { type Mocked } from "vitest";

import { getOsVersionCommandResponseMockBuilder } from "@api/command/os/__mocks__/GetOsVersionCommand";
import { DeviceModelId } from "@api/device/DeviceModel";
import {
  BTC_APP,
  BTC_APP_METADATA,
  ETH_APP,
  ETH_APP_METADATA,
} from "@api/device-action/__test-utils__/data";
import { type DmkConfig } from "@api/DmkConfig";
import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
import { HttpFetchApiError } from "@internal/manager-api/model/Errors";

import { DefaultManagerApiService } from "./DefaultManagerApiService";
import { type ManagerApiService } from "./ManagerApiService";

vi.mock("@internal/manager-api/data/AxiosManagerApiDataSource");
let dataSource: Mocked<AxiosManagerApiDataSource>;
let service: ManagerApiService;
describe("ManagerApiService", () => {
  beforeEach(() => {
    dataSource = new AxiosManagerApiDataSource(
      {} as DmkConfig,
    ) as Mocked<AxiosManagerApiDataSource>;
    service = new DefaultManagerApiService(dataSource);
  });

  describe("getAppList", () => {
    it("should call api with the correct parameters", () => {
      // given
      const deviceInfo = getOsVersionCommandResponseMockBuilder(
        DeviceModelId.STAX,
      );
      const provider = 42;
      // when
      service.getAppList(deviceInfo, provider);
      // then
      expect(dataSource.getAppList).toHaveBeenCalledWith({
        targetId: "857735172",
        provider: 42,
        firmwareVersionName: "1.3.0",
      });
    });
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
      const deviceInfo = getOsVersionCommandResponseMockBuilder(
        DeviceModelId.STAX,
      );
      const provider = 42;
      // when
      service.getDeviceVersion(deviceInfo, provider);
      // then
      expect(dataSource.getDeviceVersion).toHaveBeenCalledWith({
        targetId: "857735172",
        provider: 42,
      });
    });
  });
  describe("getFirmwareVersion", () => {
    it("should call api with the correct parameters", () => {
      // given
      const mockGetDeviceVersion = {
        id: 17,
        target_id: "857735172",
      };
      const deviceInfo = getOsVersionCommandResponseMockBuilder(
        DeviceModelId.STAX,
      );
      const provider = 42;
      // when
      service.getFirmwareVersion(deviceInfo, mockGetDeviceVersion, provider);
      // then
      expect(dataSource.getFirmwareVersion).toHaveBeenCalledWith({
        deviceId: 17,
        provider: 42,
        version: "1.3.0",
      });
    });
  });
});
