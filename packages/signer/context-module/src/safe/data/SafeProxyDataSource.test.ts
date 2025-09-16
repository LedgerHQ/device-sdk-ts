import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { ProxyResolver } from "@/proxy/model/ProxyResolver";

import { SafeProxyDataSource } from "./SafeProxyDataSource";

describe("SafeProxyDataSource", () => {
  const mockConfig: ContextModuleConfig = {
    metadataServiceDomain: {
      url: "https://metadata.api.ledger.com",
    },
    originToken: "test-origin-token",
  } as ContextModuleConfig;

  describe("constructor", () => {
    it("should create instance with SAFE_GATEWAY resolver", () => {
      // WHEN
      const datasource = new SafeProxyDataSource(mockConfig);

      // THEN
      expect(datasource).toBeInstanceOf(SafeProxyDataSource);
      expect(datasource.resolver).toBe(ProxyResolver.SAFE_GATEWAY);
    });

    it("should pass config to parent constructor", () => {
      // WHEN
      const datasource = new SafeProxyDataSource(mockConfig);

      // THEN
      expect(datasource).toBeInstanceOf(SafeProxyDataSource);
      // The config is passed to the parent class and accessible through its methods
      expect(datasource).toBeDefined();
    });
  });

  describe("inheritance", () => {
    it("should inherit all methods from HttpProxyDataSource", () => {
      // GIVEN
      const datasource = new SafeProxyDataSource(mockConfig);

      // THEN
      expect(datasource.getProxyDelegateCall).toBeDefined();
      expect(datasource.getProxyImplementationAddress).toBeDefined();
      expect(typeof datasource.getProxyDelegateCall).toBe("function");
      expect(typeof datasource.getProxyImplementationAddress).toBe("function");
    });
  });
});
