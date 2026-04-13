import axios from "axios";
import { Left, Right } from "purify-ts";
import { lastValueFrom, toArray } from "rxjs";

import type { InternalApi } from "@api/device-action/DeviceAction";
import {
  OutOfMemoryDAError,
  RefusedByUserDAError,
  UnknownDAError,
} from "@api/device-action/os/Errors";
import { ApduResponse } from "@api/device-session/ApduResponse";

import { InstallLanguagePackageTask } from "./InstallLanguagePackageTask";

vi.mock("axios");

describe("InstallLanguagePackageTask", () => {
  let api: InternalApi;
  const sendApdu = vi.fn();

  const SUCCESS_STATUS = new Uint8Array([0x90, 0x00]);
  const REFUSED_STATUS = new Uint8Array([0x55, 0x01]);
  const OUT_OF_MEMORY_STATUS = new Uint8Array([0x6a, 0x84]);
  const UNKNOWN_ERROR_STATUS = new Uint8Array([0x67, 0x00]);

  function makeApduResponse(statusCode: Uint8Array) {
    return new ApduResponse({ statusCode, data: new Uint8Array() });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api = { sendApdu } as unknown as InternalApi;
  });

  describe("success", () => {
    it("should send all APDUs and emit progress events", async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: "e0c4000000\ne0c4010000\ne0c4020000",
      });
      sendApdu
        .mockResolvedValueOnce(Right(makeApduResponse(SUCCESS_STATUS)))
        .mockResolvedValueOnce(Right(makeApduResponse(SUCCESS_STATUS)))
        .mockResolvedValueOnce(Right(makeApduResponse(SUCCESS_STATUS)));

      const task = new InstallLanguagePackageTask(api, {
        apduInstallUrl: "https://example.com/install",
      });

      const events = await lastValueFrom(task.run().pipe(toArray()));

      expect(axios.get).toHaveBeenCalledWith("https://example.com/install");
      expect(sendApdu).toHaveBeenCalledTimes(3);
      expect(events).toEqual([
        { type: "progress", progress: 1 / 3 },
        { type: "progress", progress: 2 / 3 },
        { type: "progress", progress: 1 },
      ]);
    });

    it("should handle a single APDU", async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: "e0c4000000",
      });
      sendApdu.mockResolvedValueOnce(Right(makeApduResponse(SUCCESS_STATUS)));

      const task = new InstallLanguagePackageTask(api, {
        apduInstallUrl: "https://example.com/install",
      });

      const events = await lastValueFrom(task.run().pipe(toArray()));

      expect(sendApdu).toHaveBeenCalledTimes(1);
      expect(events).toEqual([{ type: "progress", progress: 1 }]);
    });

    it("should skip empty lines in APDU data", async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: "e0c4000000\n\ne0c4010000\n",
      });
      sendApdu
        .mockResolvedValueOnce(Right(makeApduResponse(SUCCESS_STATUS)))
        .mockResolvedValueOnce(Right(makeApduResponse(SUCCESS_STATUS)));

      const task = new InstallLanguagePackageTask(api, {
        apduInstallUrl: "https://example.com/install",
      });

      const events = await lastValueFrom(task.run().pipe(toArray()));

      expect(sendApdu).toHaveBeenCalledTimes(2);
      expect(events).toEqual([
        { type: "progress", progress: 0.5 },
        { type: "progress", progress: 1 },
      ]);
    });

    it("should handle Windows-style line endings", async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: "e0c4000000\r\ne0c4010000",
      });
      sendApdu
        .mockResolvedValueOnce(Right(makeApduResponse(SUCCESS_STATUS)))
        .mockResolvedValueOnce(Right(makeApduResponse(SUCCESS_STATUS)));

      const task = new InstallLanguagePackageTask(api, {
        apduInstallUrl: "https://example.com/install",
      });

      const events = await lastValueFrom(task.run().pipe(toArray()));

      expect(sendApdu).toHaveBeenCalledTimes(2);
      expect(events).toEqual([
        { type: "progress", progress: 0.5 },
        { type: "progress", progress: 1 },
      ]);
    });
  });

  describe("error", () => {
    it("should throw UnknownDAError for invalid APDU hex data", async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: "ZZZZ",
      });

      const task = new InstallLanguagePackageTask(api, {
        apduInstallUrl: "https://example.com/install",
      });

      await expect(lastValueFrom(task.run())).rejects.toEqual(
        new UnknownDAError("Invalid APDU data: ZZZZ"),
      );
      expect(sendApdu).not.toHaveBeenCalled();
    });

    it("should throw UnknownDAError for too-short APDU data", async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: "e0c4",
      });

      const task = new InstallLanguagePackageTask(api, {
        apduInstallUrl: "https://example.com/install",
      });

      await expect(lastValueFrom(task.run())).rejects.toEqual(
        new UnknownDAError("Invalid APDU data: e0c4"),
      );
      expect(sendApdu).not.toHaveBeenCalled();
    });

    it("should throw UnknownDAError on device communication error (Left)", async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: "e0c4000000",
      });
      sendApdu.mockResolvedValueOnce(Left(new Error("Transport error")));

      const task = new InstallLanguagePackageTask(api, {
        apduInstallUrl: "https://example.com/install",
      });

      await expect(lastValueFrom(task.run())).rejects.toEqual(
        new UnknownDAError(
          "Device communication error: Error: Transport error",
        ),
      );
    });

    it("should throw RefusedByUserDAError when device refuses", async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: "e0c4000000",
      });
      sendApdu.mockResolvedValueOnce(Right(makeApduResponse(REFUSED_STATUS)));

      const task = new InstallLanguagePackageTask(api, {
        apduInstallUrl: "https://example.com/install",
      });

      await expect(lastValueFrom(task.run())).rejects.toEqual(
        new RefusedByUserDAError("Language install refused on device."),
      );
    });

    it("should throw OutOfMemoryDAError when device is out of memory", async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: "e0c4000000",
      });
      sendApdu.mockResolvedValueOnce(
        Right(makeApduResponse(OUT_OF_MEMORY_STATUS)),
      );

      const task = new InstallLanguagePackageTask(api, {
        apduInstallUrl: "https://example.com/install",
      });

      await expect(lastValueFrom(task.run())).rejects.toEqual(
        new OutOfMemoryDAError("Not enough space for language pack."),
      );
    });

    it("should throw UnknownDAError for unexpected device response status", async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: "e0c4000000",
      });
      sendApdu.mockResolvedValueOnce(
        Right(makeApduResponse(UNKNOWN_ERROR_STATUS)),
      );

      const task = new InstallLanguagePackageTask(api, {
        apduInstallUrl: "https://example.com/install",
      });

      await expect(lastValueFrom(task.run())).rejects.toEqual(
        new UnknownDAError("Unexpected device response: 0x6700"),
      );
    });

    it("should error on second APDU after first succeeds", async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        data: "e0c4000000\ne0c4010000",
      });
      sendApdu
        .mockResolvedValueOnce(Right(makeApduResponse(SUCCESS_STATUS)))
        .mockResolvedValueOnce(Right(makeApduResponse(REFUSED_STATUS)));

      const task = new InstallLanguagePackageTask(api, {
        apduInstallUrl: "https://example.com/install",
      });

      const events: Array<{ type: string; progress: number }> = [];
      await expect(
        new Promise<void>((resolve, reject) => {
          task.run().subscribe({
            next: (event) => events.push(event),
            error: reject,
            complete: resolve,
          });
        }),
      ).rejects.toEqual(
        new RefusedByUserDAError("Language install refused on device."),
      );
      expect(events).toEqual([{ type: "progress", progress: 0.5 }]);
    });
  });
});
