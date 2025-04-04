import axios from "axios";
import { Left, Right } from "purify-ts";

import {
  BTC_APP,
  BTC_APP_METADATA,
  CUSTOM_LOCK_SCREEN_APP,
  CUSTOM_LOCK_SCREEN_APP_METADATA,
  ETH_APP_METADATA,
} from "@api/device-action/__test-utils__/data";
import { type DmkConfig } from "@api/DmkConfig";
import { HttpFetchApiError } from "@internal/manager-api/model/Errors";

import { AxiosManagerApiDataSource } from "./AxiosManagerApiDataSource";
import { type ManagerApiDataSource } from "./ManagerApiDataSource";

vi.mock("axios");

describe("AxiosManagerApiDataSource", () => {
  describe("getAppList", () => {
    let api: ManagerApiDataSource;
    beforeEach(() => {
      api = new AxiosManagerApiDataSource({} as DmkConfig);
    });
    afterEach(() => {
      vi.clearAllMocks();
    });
    it("should return a list of applications", async () => {
      // given
      const apps = [BTC_APP_METADATA, ETH_APP_METADATA];
      vi.spyOn(axios, "get").mockResolvedValue({ data: apps });

      // when
      const response = await api.getAppList({
        targetId: "targetId",
        firmwareVersionName: "firmwareVersionName",
      });

      // then
      expect(response).toEqual(Right(apps));
    });
    it("should return an error if payload don't match the dto", async () => {
      // given
      const { versionId, ...rest } = BTC_APP_METADATA;
      const apps = [{ versionId: "invalidVersion", ...rest }];
      vi.spyOn(axios, "get").mockResolvedValue({ data: apps });

      // when
      const response = await api.getAppList({
        targetId: "targetId",
        firmwareVersionName: "firmwareVersionName",
      });

      // then
      expect(response.isRight()).toEqual(false);
    });
    it("should return an error if the request fails", async () => {
      // given
      const error = new Error("fetch error");
      vi.spyOn(axios, "get").mockRejectedValue(error);

      // when
      const response = await api.getAppList({
        targetId: "targetId",
        firmwareVersionName: "firmwareVersionName",
      });

      // then
      expect(response).toEqual(Left(new HttpFetchApiError(error)));
    });
  });
  describe("getAppsByHash", () => {
    describe("success cases", () => {
      let api: ManagerApiDataSource;
      beforeEach(() => {
        api = new AxiosManagerApiDataSource({} as DmkConfig);
      });
      afterEach(() => {
        vi.clearAllMocks();
      });
      it("with BTC app, should return the metadata", async () => {
        vi.spyOn(axios, "post").mockResolvedValue({
          data: [BTC_APP_METADATA],
        });

        const hashes = [BTC_APP.appFullHash];

        const apps = await api.getAppsByHash({ hashes });

        expect(apps).toEqual(Right([BTC_APP_METADATA]));
      });

      it("with no apps, should return an empty list", async () => {
        vi.spyOn(axios, "post").mockResolvedValue({
          data: [],
        });

        const hashes: string[] = [];

        const apps = await api.getAppsByHash({ hashes });

        expect(apps).toEqual(Right([]));
      });

      it("with BTC app and custom lock screen, should return the metadata", async () => {
        vi.spyOn(axios, "post").mockResolvedValue({
          data: [BTC_APP_METADATA, CUSTOM_LOCK_SCREEN_APP_METADATA],
        });

        const hashes = [
          BTC_APP.appFullHash,
          CUSTOM_LOCK_SCREEN_APP.appFullHash,
        ];

        const apps = await api.getAppsByHash({ hashes });

        expect(apps).toEqual(
          Right([BTC_APP_METADATA, CUSTOM_LOCK_SCREEN_APP_METADATA]),
        );
      });
    });

    describe("error cases", () => {
      let api: ManagerApiDataSource;
      beforeEach(() => {
        api = new AxiosManagerApiDataSource({} as DmkConfig);
      });
      afterEach(() => {
        vi.clearAllMocks();
      });
      it("with BTC app, should fail if payload don't match the dto", async () => {
        const { versionId, ...rest } = BTC_APP_METADATA;
        vi.spyOn(axios, "post").mockResolvedValue({
          data: [{ versionId: "invalidVersion", ...rest }],
        });

        const hashes = [BTC_APP.appFullHash];

        const apps = await api.getAppsByHash({ hashes });

        expect(apps.isRight()).toEqual(false);
      });

      it("should throw an error if the request fails", async () => {
        // given
        const api = new AxiosManagerApiDataSource({} as DmkConfig);

        const err = new Error("fetch error");
        vi.spyOn(axios, "post").mockRejectedValue(err);

        const hashes = [BTC_APP.appFullHash];

        // when
        const response = await api.getAppsByHash({ hashes });

        // then
        expect(response).toEqual(Left(new HttpFetchApiError(err)));
      });
    });
  });

  describe("getDeviceVersion", () => {
    let api: ManagerApiDataSource;
    beforeEach(() => {
      api = new AxiosManagerApiDataSource({} as DmkConfig);
    });
    afterEach(() => {
      vi.clearAllMocks();
    });
    it("should return a complete device version", async () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({
        data: {
          id: 17,
          target_id: "857735172",
        },
      });

      // when
      const response = await api.getDeviceVersion({
        targetId: "targetId",
      });

      // then
      expect(response).toEqual(Right({ id: 17 }));
    });

    it("should return an error if payload don't match dto", async () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({
        data: {
          target_id: "857735172",
        },
      });

      // when
      const response = await api.getDeviceVersion({
        targetId: "targetId",
      });

      // then
      expect(response.isRight()).toEqual(false);
    });

    it("should return an error if the request fails", async () => {
      // given

      const error = new Error("fetch error");
      vi.spyOn(axios, "get").mockRejectedValue(error);

      // when
      const response = await api.getDeviceVersion({
        targetId: "targetId",
      });

      // then
      expect(response).toEqual(Left(new HttpFetchApiError(error)));
    });
  });

  describe("getFirmwareVersion", () => {
    let api: ManagerApiDataSource;
    beforeEach(() => {
      api = new AxiosManagerApiDataSource({} as DmkConfig);
    });
    afterEach(() => {
      vi.clearAllMocks();
    });
    it("should return a complete firmware version", async () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({
        data: {
          id: 361,
          version: "1.6.0",
          perso: "perso_11",
          firmware: null,
          firmware_key: "testKey",
          hash: "hash",
          bytes: 194,
          mcu_versions: [1, 5, 7],
        },
      });

      // when
      const response = await api.getFirmwareVersion({
        version: "versionName",
        deviceId: 42,
      });

      // then
      expect(response).toEqual(
        Right({
          id: 361,
          version: "1.6.0",
          perso: "perso_11",
          firmware: null,
          firmwareKey: "testKey",
          hash: "hash",
          bytes: 194,
          mcuVersions: [1, 5, 7],
        }),
      );
    });
    it("should return an error if payload don't match the dto", async () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({
        data: {
          id: "invalidId",
          version: "1.6.0",
          perso: "perso_11",
          firmware: null,
          firmware_key: "testKey",
          hash: "hash",
          bytes: 194,
          mcu_versions: [1, 5, 7],
        },
      });

      // when
      const response = await api.getFirmwareVersion({
        version: "versionName",
        deviceId: 42,
      });

      // then
      expect(response.isRight()).toEqual(false);
    });
    it("should return an error if the request fails", async () => {
      // given
      const error = new Error("fetch error");
      vi.spyOn(axios, "get").mockRejectedValue(error);

      // when
      const response = await api.getFirmwareVersion({
        version: "versionName",
        deviceId: 42,
      });

      // then
      expect(response).toEqual(Left(new HttpFetchApiError(error)));
    });
  });

  describe("setProvider", () => {
    let api: AxiosManagerApiDataSource;
    beforeEach(() => {
      api = new AxiosManagerApiDataSource({
        managerApiUrl: "http://fake-url.com",
        provider: 1,
      } as DmkConfig);
    });

    it("should not change the provider if the new value is the same", () => {
      // given
      const initialProvider = (api as unknown as { _provider: number })
        ._provider;

      // when
      api.setProvider(initialProvider);

      // then
      expect((api as unknown as { _provider: number })._provider).toBe(
        initialProvider,
      );
    });

    it("should not change the provider if the new value is less than 1", () => {
      // given
      const initialProvider = (api as unknown as { _provider: number })
        ._provider;

      // when
      api.setProvider(0); // invalid
      api.setProvider(-5); // invalid

      // then
      expect((api as unknown as { _provider: number })._provider).toBe(
        initialProvider,
      );
    });

    it("should update the provider if a valid and different value is provided", () => {
      // given
      const newProvider = 2;

      // when
      api.setProvider(newProvider);

      // then
      expect((api as unknown as { _provider: number })._provider).toBe(
        newProvider,
      );
    });
  });

  describe("getFirmwareVersionById", () => {
    let api: ManagerApiDataSource;
    beforeEach(() => {
      api = new AxiosManagerApiDataSource({} as DmkConfig);
    });
    afterEach(() => {
      vi.clearAllMocks();
    });
    it("should return a complete firmware version", async () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({
        data: {
          id: 361,
          version: "1.6.0",
          perso: "perso_11",
          firmware: null,
          firmware_key: "testKey",
          hash: "hash",
          bytes: 194,
          mcu_versions: [1, 5, 7],
        },
      });

      // when
      const response = await api.getFirmwareVersionById(42);

      // then
      expect(response).toEqual(
        Right({
          id: 361,
          version: "1.6.0",
          perso: "perso_11",
          firmware: null,
          firmwareKey: "testKey",
          hash: "hash",
          bytes: 194,
          mcuVersions: [1, 5, 7],
        }),
      );
    });
  });

  describe("getLatestFirmwareVersion", () => {
    let api: ManagerApiDataSource;
    beforeEach(() => {
      api = new AxiosManagerApiDataSource({} as DmkConfig);
    });
    afterEach(() => {
      vi.clearAllMocks();
    });
    it("should return the latest firmware version", async () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({
        data: {
          result: "success",
          se_firmware_osu_version: {
            id: 361,
            perso: "perso_11",
            firmware: "test",
            firmware_key: "testKey",
            hash: "hash",
            next_se_firmware_final_version: 567,
          },
        },
      });

      // when
      const response = await api.getLatestFirmwareVersion({
        currentFinalFirmwareId: 200,
        deviceId: 42,
      });

      // then
      expect(response).toEqual(
        Right({
          id: 361,
          perso: "perso_11",
          firmware: "test",
          firmwareKey: "testKey",
          hash: "hash",
          nextFinalFirmware: 567,
        }),
      );
    });
    it("should return an error if result is not success", async () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({
        data: {
          result: "failed",
          se_firmware_osu_version: null,
        },
      });

      // when
      const response = await api.getLatestFirmwareVersion({
        currentFinalFirmwareId: 200,
        deviceId: 42,
      });

      // then
      expect(response.isRight()).toEqual(false);
    });
    it("should return an error if payload don't match the dto", async () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({
        data: {
          result: "success",
          se_firmware_osu_version: {
            id: "InvalidId",
            perso: "perso_11",
            firmware: "test",
            firmware_key: "testKey",
            hash: "hash",
            next_se_firmware_final_version: 567,
          },
        },
      });

      // when
      const response = await api.getLatestFirmwareVersion({
        currentFinalFirmwareId: 200,
        deviceId: 42,
      });

      // then
      expect(response.isRight()).toEqual(false);
    });
    it("should return an error if the request fails", async () => {
      // given
      const error = new Error("fetch error");
      vi.spyOn(axios, "get").mockRejectedValue(error);

      // when
      const response = await api.getLatestFirmwareVersion({
        currentFinalFirmwareId: 200,
        deviceId: 42,
      });

      // then
      expect(response).toEqual(Left(new HttpFetchApiError(error)));
    });
  });

  describe("getOsuFirmwareVersion", () => {
    let api: ManagerApiDataSource;
    beforeEach(() => {
      api = new AxiosManagerApiDataSource({} as DmkConfig);
    });
    afterEach(() => {
      vi.clearAllMocks();
    });
    it("should return a complete OSU firmware version", async () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({
        data: {
          id: 361,
          perso: "perso_11",
          firmware: "test",
          firmware_key: "testKey",
          hash: "hash",
          next_se_firmware_final_version: 567,
        },
      });

      // when
      const response = await api.getOsuFirmwareVersion({
        version: "versionName",
        deviceId: 42,
      });

      // then
      expect(response).toEqual(
        Right({
          id: 361,
          perso: "perso_11",
          firmware: "test",
          firmwareKey: "testKey",
          hash: "hash",
          nextFinalFirmware: 567,
        }),
      );
    });
    it("should return an error if payload don't match the dto", async () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({
        data: {
          id: "invalidId",
          perso: "perso_11",
          firmware: "test",
          firmware_key: "testKey",
          hash: "hash",
          next_se_firmware_final_version: 567,
        },
      });

      // when
      const response = await api.getOsuFirmwareVersion({
        version: "versionName",
        deviceId: 42,
      });

      // then
      expect(response.isRight()).toEqual(false);
    });
    it("should return an error if the request fails", async () => {
      // given
      const error = new Error("fetch error");
      vi.spyOn(axios, "get").mockRejectedValue(error);

      // when
      const response = await api.getOsuFirmwareVersion({
        version: "versionName",
        deviceId: 42,
      });

      // then
      expect(response).toEqual(Left(new HttpFetchApiError(error)));
    });
  });

  describe("getLanguagePackages", () => {
    let api: ManagerApiDataSource;
    beforeEach(() => {
      api = new AxiosManagerApiDataSource({} as DmkConfig);
    });
    afterEach(() => {
      vi.clearAllMocks();
    });
    it("should return the langage packages version", async () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({
        data: [
          {
            language: "turkish",
            languagePackageVersionId: 474,
            version: "0.0.4",
            language_package_id: 57,
            apdu_install_url:
              "https://download.languages.ledger.com/stax/turkish/bolos_1.6.2_pack_0.0.4_tr.apdu",
            apdu_uninstall_url:
              "https://download.languages.ledger.com/stax/turkish/bolos_1.6.2_pack_0.0.4_tr_del.apdu",
            device_versions: [17],
            se_firmware_final_versions: [432],
            bytes: 20800,
            date_creation: "2025-03-04T10:48:27.910630Z",
            date_last_modified: "2025-03-04T10:48:27.910630Z",
          },
          {
            language: "russian",
            languagePackageVersionId: 470,
            version: "0.0.4",
            language_package_id: 56,
            apdu_install_url:
              "https://download.languages.ledger.com/stax/russian/bolos_1.6.2_pack_0.0.4_ru.apdu",
            apdu_uninstall_url:
              "https://download.languages.ledger.com/stax/russian/bolos_1.6.2_pack_0.0.4_ru_del.apdu",
            device_versions: [17],
            se_firmware_final_versions: [432],
            bytes: 46592,
            date_creation: "2025-03-04T10:48:26.218729Z",
            date_last_modified: "2025-03-04T10:48:26.218729Z",
          },
        ],
      });

      // when
      const response = await api.getLanguagePackages({
        deviceId: 1,
        currentFinalFirmwareId: 42,
      });

      // then
      expect(response).toEqual(
        Right([
          {
            language: "turkish",
            languagePackageVersionId: 474,
            version: "0.0.4",
            languagePackageId: 57,
            apduInstallUrl:
              "https://download.languages.ledger.com/stax/turkish/bolos_1.6.2_pack_0.0.4_tr.apdu",
            apduUninstallUrl:
              "https://download.languages.ledger.com/stax/turkish/bolos_1.6.2_pack_0.0.4_tr_del.apdu",
            bytes: 20800,
            dateCreation: "2025-03-04T10:48:27.910630Z",
            dateLastModified: "2025-03-04T10:48:27.910630Z",
          },
          {
            language: "russian",
            languagePackageVersionId: 470,
            version: "0.0.4",
            languagePackageId: 56,
            apduInstallUrl:
              "https://download.languages.ledger.com/stax/russian/bolos_1.6.2_pack_0.0.4_ru.apdu",
            apduUninstallUrl:
              "https://download.languages.ledger.com/stax/russian/bolos_1.6.2_pack_0.0.4_ru_del.apdu",
            bytes: 46592,
            dateCreation: "2025-03-04T10:48:26.218729Z",
            dateLastModified: "2025-03-04T10:48:26.218729Z",
          },
        ]),
      );
    });
    it("should return an error if payload don't match the dto", async () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({
        data: [
          {
            language: "turkish",
            version: "0.0.4",
            language_package_id: "invalid",
          },
        ],
      });

      // when
      const response = await api.getLanguagePackages({
        deviceId: 1,
        currentFinalFirmwareId: 42,
      });

      // then
      expect(response.isRight()).toEqual(false);
    });
    it("should return an error if the request fails", async () => {
      // given
      const error = new Error("fetch error");
      vi.spyOn(axios, "get").mockRejectedValue(error);

      // when
      const response = await api.getLanguagePackages({
        deviceId: 1,
        currentFinalFirmwareId: 42,
      });

      // then
      expect(response).toEqual(Left(new HttpFetchApiError(error)));
    });
  });

  describe("getMcuList", () => {
    let api: ManagerApiDataSource;
    beforeEach(() => {
      api = new AxiosManagerApiDataSource({} as DmkConfig);
    });
    afterEach(() => {
      vi.clearAllMocks();
    });
    it("should return a the list of MCUs", async () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({
        data: [
          {
            id: 1,
            mcu: 1,
            name: "1.0",
            description: null,
            providers: [],
            device_versions: [1, 2],
            from_bootloader_version: "",
            from_bootloader_version_id: 2,
            se_firmware_final_versions: [7, 12, 13, 14, 15],
            date_creation: "2018-09-20T13:30:50.156394Z",
            date_last_modified: "2018-09-20T13:30:50.156453Z",
          },
          {
            id: 2,
            mcu: 1,
            name: "1.1",
            description: null,
            providers: [],
            device_versions: [1, 2],
            from_bootloader_version: "",
            from_bootloader_version_id: 2,
            se_firmware_final_versions: [7, 12, 13, 14, 15],
            date_creation: "2018-09-20T13:30:50.339966Z",
            date_last_modified: "2018-09-20T13:30:50.340031Z",
          },
        ],
      });

      // when
      const response = await api.getMcuList();

      // then
      expect(response).toEqual(
        Right([
          {
            id: 1,
            name: "1.0",
          },
          {
            id: 2,
            name: "1.1",
          },
        ]),
      );
    });

    it("should return an error when the payload don't match the dto", async () => {
      // given
      vi.spyOn(axios, "get").mockResolvedValue({
        data: [
          {
            id: "invalid id",
            mcu: 1,
            name: "1.0",
            description: null,
            providers: [],
            se_firmware_final_versions: [7, 12, 13, 14, 15],
            date_creation: "2018-09-20T13:30:50.156394Z",
            date_last_modified: "2018-09-20T13:30:50.156453Z",
          },
        ],
      });

      // when
      const response = await api.getMcuList();

      // then
      expect(response.isRight()).toEqual(false);
    });

    it("should return an error if the request fails", async () => {
      // given
      const error = new Error("fetch error");
      vi.spyOn(axios, "get").mockRejectedValue(error);

      // when
      const response = await api.getMcuList();

      // then
      expect(response).toEqual(Left(new HttpFetchApiError(error)));
    });
  });
  describe("getProvider", () => {
    let api: AxiosManagerApiDataSource;
    beforeEach(() => {
      api = new AxiosManagerApiDataSource({
        managerApiUrl: "http://fake-url.com",
        provider: 123,
      } as DmkConfig);
    });
    afterEach(() => {
      vi.clearAllMocks();
    });

    it("should return the initial provider", () => {
      expect(api.getProvider()).toBe(123);
    });

    it("should return the updated provider after setProvider is called", () => {
      api.setProvider(321);
      expect(api.getProvider()).toBe(321);
    });
  });
});
