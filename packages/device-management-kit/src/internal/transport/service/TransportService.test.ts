import { Maybe } from "purify-ts";

import { type DeviceModelDataSource } from "@api/device-model/data/DeviceModelDataSource";
import { StaticDeviceModelDataSource } from "@api/device-model/data/StaticDeviceModelDataSource";
import { type ApduReceiverServiceFactory } from "@api/device-session/service/ApduReceiverService";
import { type ApduSenderServiceFactory } from "@api/device-session/service/ApduSenderService";
import { defaultApduReceiverServiceStubBuilder } from "@api/device-session/service/DefaultApduReceiverService.stub";
import { defaultApduSenderServiceStubBuilder } from "@api/device-session/service/DefaultApduSenderService.stub";
import { type DmkConfig } from "@api/DmkConfig";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { TransportAlreadyExistsError } from "@api/transport/model/Errors";
import {
  type Transport,
  type TransportFactory,
} from "@api/transport/model/Transport";
import { TransportStub } from "@api/transport/model/Transport.stub";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";

import { TransportService } from "./TransportService";

let apduSenderService: ApduSenderServiceFactory;
let apduReceiverService: ApduReceiverServiceFactory;
let logger: LoggerPublisherService;
let config: DmkConfig;
let transportFactory: TransportFactory;
let transport: Transport;
let transportFactory2: TransportFactory;
let transport2: Transport;
let deviceModelDataSource: DeviceModelDataSource;
let transportService: TransportService;
let loggerFactory: () => LoggerPublisherService;

describe("TransportService", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService([], "transport-service");
    apduSenderService = jest.fn().mockImplementation(() => {
      return defaultApduSenderServiceStubBuilder(undefined, () => logger);
    });
    apduReceiverService = jest.fn().mockImplementation(() => {
      return defaultApduReceiverServiceStubBuilder(undefined, () => logger);
    });
    deviceModelDataSource = new StaticDeviceModelDataSource();
    config = {} as DmkConfig;
    transport = new TransportStub();
    transport2 = new TransportStub();
    jest.spyOn(transport, "getIdentifier").mockReturnValue("transport");
    jest.spyOn(transport2, "getIdentifier").mockReturnValue("transport2");
    transportFactory = jest.fn().mockImplementation(() => transport);
    transportFactory2 = jest.fn().mockImplementation(() => transport2);
    loggerFactory = jest.fn().mockImplementation(() => logger);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("constructor", () => {
    describe("when no transports are provided", () => {
      let spy: jest.SpyInstance;
      beforeEach(() => {
        spy = jest.spyOn(logger, "warn");
        transportService = new TransportService(
          [],
          config,
          loggerFactory,
          deviceModelDataSource,
          apduSenderService,
          apduReceiverService,
        );
      });

      it("should not throw an error", () => {
        expect(transportService).toBeDefined();
      });

      it("should log a warning", () => {
        expect(spy).toHaveBeenCalledWith(
          "No transports provided, please check your configuration",
        );
      });
    });

    describe("when transports are provided", () => {
      it("should add 1 transport", () => {
        transportService = new TransportService(
          [transportFactory],
          config,
          loggerFactory,
          deviceModelDataSource,
          apduSenderService,
          apduReceiverService,
        );

        expect(transportService.getAllTransports()).toEqual([transport]);
      });

      it("should add multiple transports", () => {
        transportService = new TransportService(
          [transportFactory, transportFactory2],
          config,
          loggerFactory,
          deviceModelDataSource,
          apduSenderService,
          apduReceiverService,
        );

        const transports = transportService.getAllTransports();
        expect(transports).toEqual([transport, transport2]);
      });

      it("should not add duplicate transports", () => {
        try {
          new TransportService(
            [transportFactory, transportFactory],
            config,
            loggerFactory,
            deviceModelDataSource,
            apduSenderService,
            apduReceiverService,
          );
        } catch (error) {
          expect(error).toBeInstanceOf(TransportAlreadyExistsError);
        }
      });
    });
  });

  describe("addTransport", () => {
    beforeEach(() => {
      transportService = new TransportService(
        [transportFactory],
        config,
        loggerFactory,
        deviceModelDataSource,
        apduSenderService,
        apduReceiverService,
      );
    });

    it("can add a new transport", () => {
      transportService.addTransport(transportFactory2);

      const transports = transportService.getAllTransports();
      expect(transports).toEqual([transport, transport2]);
    });

    it("calls the transport factory function with the correct arguments", () => {
      transportService.addTransport(transportFactory2);

      expect(transportFactory2).toHaveBeenCalledWith({
        loggerServiceFactory: loggerFactory,
        config,
        apduSenderServiceFactory: apduSenderService,
        apduReceiverServiceFactory: apduReceiverService,
        deviceModelDataSource,
      });
    });

    it("throw if transport already exists", () => {
      try {
        transportService.addTransport(transportFactory);
      } catch (error) {
        expect(error).toBeInstanceOf(TransportAlreadyExistsError);
      }
    });
  });

  describe("getTransport", () => {
    beforeEach(() => {
      transportService = new TransportService(
        [transportFactory],
        config,
        loggerFactory,
        deviceModelDataSource,
        apduSenderService,
        apduReceiverService,
      );
    });

    it("returns the transport", () => {
      const t = transportService.getTransport("transport");
      expect(t).toEqual(Maybe.of(transport));
    });

    it("returns Nothing if the transport identifier does not exist", () => {
      const t = transportService.getTransport("transport2");
      expect(t).toEqual(Maybe.empty());
    });

    it("returns Nothing if no identifier is provided", () => {
      const t = transportService.getTransport();
      expect(t).toEqual(Maybe.empty());
    });
  });

  describe("getAllTransports", () => {
    it("returns all transports", () => {
      transportService = new TransportService(
        [transportFactory],
        config,
        loggerFactory,
        deviceModelDataSource,
        apduSenderService,
        apduReceiverService,
      );
      const transports = transportService.getAllTransports();
      expect(transports).toEqual([transport]);
    });

    it("returns an empty array if no transports are added", () => {
      transportService = new TransportService(
        [],
        config,
        loggerFactory,
        deviceModelDataSource,
        apduSenderService,
        apduReceiverService,
      );

      const transports = transportService.getAllTransports();
      expect(transports).toEqual([]);
    });

    it("returns all transports", () => {
      transportService = new TransportService(
        [transportFactory, transportFactory2],
        config,
        loggerFactory,
        deviceModelDataSource,
        apduSenderService,
        apduReceiverService,
      );

      const transports = transportService.getAllTransports();
      expect(transports).toEqual([transport, transport2]);
    });
  });
});
