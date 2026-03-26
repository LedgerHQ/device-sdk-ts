import { Container } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { type ResolvedContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { HttpProxyDataSource } from "@/proxy/data/HttpProxyDataSource";
import { HttpSafeProxyDataSource } from "@/proxy/data/HttpSafeProxyDataSource";
import { ProxyContextFieldLoader } from "@/proxy/domain/ProxyContextFieldLoader";

import { proxyModuleFactory } from "./proxyModuleFactory";
import { proxyTypes } from "./proxyTypes";

describe("proxyModuleFactory", () => {
  let container: Container;
  const mockConfig: ResolvedContextModuleConfig = {
    metadataServiceDomain: {
      url: "https://metadata.api.live.ledger.com",
    },
    originToken: "test-origin-token",
  } as ResolvedContextModuleConfig;

  const mockPkiCertificateLoader: PkiCertificateLoader = {
    loadCertificate: vi.fn(),
  };

  beforeEach(() => {
    container = new Container();
    // Bind the config that the datasources depend on
    container.bind(configTypes.Config).toConstantValue(mockConfig);
    // Bind the PKI certificate loader that ProxyContextFieldLoader depends on
    container
      .bind(pkiTypes.PkiCertificateLoader)
      .toConstantValue(mockPkiCertificateLoader);
  });

  describe("when config is undefined", () => {
    it("should bind HttpProxyDataSource as the default ProxyDataSource", () => {
      const module = proxyModuleFactory();
      container.load(module);

      const proxyDataSource = container.get(proxyTypes.ProxyDataSource);
      expect(proxyDataSource).toBeInstanceOf(HttpProxyDataSource);
    });

    it("should bind ProxyContextFieldLoader", () => {
      const module = proxyModuleFactory();
      container.load(module);

      const proxyContextFieldLoader = container.get(
        proxyTypes.ProxyContextFieldLoader,
      );
      expect(proxyContextFieldLoader).toBeInstanceOf(ProxyContextFieldLoader);
    });
  });

  describe("when config.datasource.proxy is 'safe'", () => {
    it("should bind HttpSafeProxyDataSource as the ProxyDataSource", () => {
      const config: ResolvedContextModuleConfig = {
        datasource: {
          proxy: "safe",
        },
      } as ResolvedContextModuleConfig;

      const module = proxyModuleFactory(config);
      container.load(module);

      const proxyDataSource = container.get(proxyTypes.ProxyDataSource);
      expect(proxyDataSource).toBeInstanceOf(HttpSafeProxyDataSource);
    });

    it("should bind ProxyContextFieldLoader", () => {
      const config: ResolvedContextModuleConfig = {
        datasource: {
          proxy: "safe",
        },
      } as ResolvedContextModuleConfig;

      const module = proxyModuleFactory(config);
      container.load(module);

      const proxyContextFieldLoader = container.get(
        proxyTypes.ProxyContextFieldLoader,
      );
      expect(proxyContextFieldLoader).toBeInstanceOf(ProxyContextFieldLoader);
    });
  });

  describe("when config.datasource.proxy is 'default'", () => {
    it("should bind HttpProxyDataSource as the ProxyDataSource", () => {
      const config: ResolvedContextModuleConfig = {
        datasource: {
          proxy: "default",
        },
      } as ResolvedContextModuleConfig;

      const module = proxyModuleFactory(config);
      container.load(module);

      const proxyDataSource = container.get(proxyTypes.ProxyDataSource);
      expect(proxyDataSource).toBeInstanceOf(HttpProxyDataSource);
    });
  });

  describe("when config.datasource is undefined", () => {
    it("should bind HttpProxyDataSource as the default ProxyDataSource", () => {
      const config: ResolvedContextModuleConfig =
        {} as ResolvedContextModuleConfig;

      const module = proxyModuleFactory(config);
      container.load(module);

      const proxyDataSource = container.get(proxyTypes.ProxyDataSource);
      expect(proxyDataSource).toBeInstanceOf(HttpProxyDataSource);
    });
  });

  describe("when config.datasource.proxy is an unexpected value", () => {
    it("should bind HttpProxyDataSource as the default ProxyDataSource", () => {
      const config: ResolvedContextModuleConfig = {
        datasource: {
          proxy: "unknown" as unknown as "safe" | "default",
        },
      } as ResolvedContextModuleConfig;

      const module = proxyModuleFactory(config);
      container.load(module);

      const proxyDataSource = container.get(proxyTypes.ProxyDataSource);
      expect(proxyDataSource).toBeInstanceOf(HttpProxyDataSource);
    });
  });
});
