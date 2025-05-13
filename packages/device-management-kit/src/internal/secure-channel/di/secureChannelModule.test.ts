import { Container } from "inversify";

import { type DmkConfig } from "@api/index";
import { DefaultSecureChannelDataSource } from "@internal/secure-channel/data/DefaultSecureChannelDataSource";
import { DefaultSecureChannelService } from "@internal/secure-channel/service/DefaultSecureChannelService";

import { secureChannelModuleFactory } from "./secureChannelModule";
import { secureChannelTypes } from "./secureChannelTypes";

describe("secureChannelModuleFactory default use case", () => {
  const mockDmkConfig = {
    webSocketUrl: "http://fake-websocket.url",
  } as DmkConfig;

  let container: Container;
  let mod: ReturnType<typeof secureChannelModuleFactory>;

  beforeEach(() => {
    mod = secureChannelModuleFactory({
      stub: false,
      config: mockDmkConfig,
    });
    container = new Container();
    container.loadSync(mod);
  });

  it("the secure channel module should be defined", () => {
    expect(mod).toBeDefined();
  });

  it("should return default use cases instead of stub", () => {
    const config = container.get(secureChannelTypes.DmkConfig);
    expect(config).toEqual({
      webSocketUrl: "http://fake-websocket.url",
    });

    const secureChannelDataSource = container.get(
      secureChannelTypes.SecureChannelDataSource,
    );
    expect(secureChannelDataSource).toBeInstanceOf(
      DefaultSecureChannelDataSource,
    );

    const secureChannelService = container.get(
      secureChannelTypes.SecureChannelService,
    );
    expect(secureChannelService).toBeInstanceOf(DefaultSecureChannelService);
  });
});
