import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { pkiTypes } from "@/modules/chain-agnostic/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/chain-agnostic/pki/domain/PkiCertificateLoader";
import { HttpProxyDataSource } from "@/modules/ethereum/proxy/data/HttpProxyDataSource";
import { HttpSafeProxyDataSource } from "@/modules/ethereum/proxy/data/HttpSafeProxyDataSource";
import { ProxyContextFieldLoader } from "@/modules/ethereum/proxy/domain/ProxyContextFieldLoader";
import { networkTypes } from "@/shared/network/di/networkTypes";

import { proxyModuleFactory } from "./proxyModuleFactory";
import { proxyTypes } from "./proxyTypes";

describe("proxyModuleFactory", () => {
  let container: Container;
  const mockConfig: ContextModuleServiceConfig = {
    metadataServiceDomain: {
      url: "https://metadata.api.live.ledger.com",
    },
    originToken: "test-origin-token",
  } as ContextModuleServiceConfig;

  const mockPkiCertificateLoader: PkiCertificateLoader = {
    loadCertificate: vi.fn(),
  };

  beforeEach(() => {
    container = new Container();
    container.bind(configTypes.Config).toConstantValue(mockConfig);
    container
      .bind(pkiTypes.PkiCertificateLoader)
      .toConstantValue(mockPkiCertificateLoader);
    container.bind(networkTypes.NetworkClient).toConstantValue({
      get: vi.fn(),
      post: vi.fn(),
    } as unknown as DmkNetworkClient);
  });

  describe("when datasource config is undefined", () => {
    it("should bind HttpProxyDataSource as the default ProxyDataSource", () => {
      const module = proxyModuleFactory();
      container.loadSync(module);

      const proxyDataSource = container.get(proxyTypes.ProxyDataSource);
      expect(proxyDataSource).toBeInstanceOf(HttpProxyDataSource);
    });

    it("should bind ProxyContextFieldLoader", () => {
      const module = proxyModuleFactory();
      container.loadSync(module);

      const proxyContextFieldLoader = container.get(
        proxyTypes.ProxyContextFieldLoader,
      );
      expect(proxyContextFieldLoader).toBeInstanceOf(ProxyContextFieldLoader);
    });
  });

  describe("when datasource.proxy is 'safe'", () => {
    it("should bind HttpSafeProxyDataSource as the ProxyDataSource", () => {
      const module = proxyModuleFactory({ proxy: "safe" });
      container.loadSync(module);

      const proxyDataSource = container.get(proxyTypes.ProxyDataSource);
      expect(proxyDataSource).toBeInstanceOf(HttpSafeProxyDataSource);
    });

    it("should bind ProxyContextFieldLoader", () => {
      const module = proxyModuleFactory({ proxy: "safe" });
      container.loadSync(module);

      const proxyContextFieldLoader = container.get(
        proxyTypes.ProxyContextFieldLoader,
      );
      expect(proxyContextFieldLoader).toBeInstanceOf(ProxyContextFieldLoader);
    });
  });

  describe("when datasource.proxy is 'default'", () => {
    it("should bind HttpProxyDataSource as the ProxyDataSource", () => {
      const module = proxyModuleFactory({ proxy: "default" });
      container.loadSync(module);

      const proxyDataSource = container.get(proxyTypes.ProxyDataSource);
      expect(proxyDataSource).toBeInstanceOf(HttpProxyDataSource);
    });
  });

  describe("when datasource has no proxy set", () => {
    it("should bind HttpProxyDataSource as the default ProxyDataSource", () => {
      const module = proxyModuleFactory({});
      container.loadSync(module);

      const proxyDataSource = container.get(proxyTypes.ProxyDataSource);
      expect(proxyDataSource).toBeInstanceOf(HttpProxyDataSource);
    });
  });

  describe("when datasource.proxy is an unexpected value", () => {
    it("should bind HttpProxyDataSource as the default ProxyDataSource", () => {
      const module = proxyModuleFactory({
        proxy: "unknown" as unknown as "safe" | "default",
      });
      container.loadSync(module);

      const proxyDataSource = container.get(proxyTypes.ProxyDataSource);
      expect(proxyDataSource).toBeInstanceOf(HttpProxyDataSource);
    });
  });
});
