import React, { createContext, useCallback, useContext, useState } from "react";

import { useXhrInterceptor } from "@/hooks/useXhrInterceptor";

const STORAGE_KEY = "erc7730_descriptors";
const CERTIFICATES_STORAGE_KEY = "cal_certificates";

type CalInterceptorContextType = {
  isActive: boolean;
  startInterception: () => void;
  stopInterception: () => void;
  storeDescriptor: (
    chainId: number,
    address: string,
    descriptorData: unknown,
  ) => void;
  storeCertificates: (certificates: Record<string, unknown>) => void;
  clearStoredDescriptors: () => void;
  getStoredDescriptorCount: () => number;
};

const initialState: CalInterceptorContextType = {
  isActive: false,
  startInterception: () => {},
  stopInterception: () => {},
  storeDescriptor: () => {},
  storeCertificates: () => {},
  clearStoredDescriptors: () => {},
  getStoredDescriptorCount: () => 0,
};

const CalInterceptorContext =
  createContext<CalInterceptorContextType>(initialState);

// Utility to store CAL descriptors in the local storage,
// and intercept network calls to the CAL to serve local descriptors
// when available
export const CalInterceptorProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);

  // Start the CAL interceptor
  const startInterception = useCallback(() => {
    setIsActive(true);
    console.log("CAL Interceptor started");
  }, []);

  // Stop the CAL interceptor
  const stopInterception = useCallback(() => {
    setIsActive(false);
    console.log("CAL Interceptor stopped");
  }, []);

  // Get descriptors from the local storage
  const getStoredDescriptors = useCallback((): Record<string, unknown> => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Failed to read stored descriptors:", error);
      return {};
    }
  }, []);

  // Store a new descriptor in the local storage
  const storeDescriptor = useCallback(
    (chainId: number, address: string, descriptorData: unknown) => {
      try {
        const descriptors = getStoredDescriptors();
        const key = `${chainId}:${address.toLowerCase()}`;

        descriptors[key] = descriptorData;

        localStorage.setItem(STORAGE_KEY, JSON.stringify(descriptors));
        console.log(`Stored descriptor for ${chainId}:${address}`);
      } catch (error) {
        console.error("Failed to store descriptor:", error);
      }
    },
    [getStoredDescriptors],
  );

  // Get certificates from the local storage
  const getStoredCertificates = useCallback((): Record<string, unknown> => {
    try {
      const stored = localStorage.getItem(CERTIFICATES_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Failed to read stored certificates:", error);
      return {};
    }
  }, []);

  // Store certificates in the local storage
  const storeCertificates = useCallback(
    (certificates: Record<string, unknown>) => {
      try {
        localStorage.setItem(
          CERTIFICATES_STORAGE_KEY,
          JSON.stringify(certificates),
        );
        console.log(`Stored ${Object.keys(certificates).length} certificates`);
      } catch (error) {
        console.error("Failed to store certificates:", error);
      }
    },
    [],
  );

  // Clear all the descriptors and certificates from the local storage
  const clearStoredDescriptors = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CERTIFICATES_STORAGE_KEY);
      console.log("Cleared all stored descriptors and certificates");
    } catch (error) {
      console.error("Failed to clear descriptors:", error);
    }
  }, []);

  // Get the amount of descriptors available
  const getStoredDescriptorCount = useCallback((): number => {
    return Object.keys(getStoredDescriptors()).length;
  }, [getStoredDescriptors]);

  // Network calls interceptor
  const calUrlPredicate = useCallback((url: string) => {
    try {
      const parsedUrl = new URL(url, window.location.origin);
      return (
        parsedUrl.origin.includes("crypto-assets-service") &&
        parsedUrl.pathname.includes("/dapps") &&
        parsedUrl.searchParams.get("output") === "descriptors_calldata"
      );
    } catch {
      return false;
    }
  }, []);

  const modifyCalResponse = useCallback(
    (url: string) => {
      try {
        const parsedUrl = new URL(url, window.location.origin);
        const chainId = parsedUrl.searchParams.get("chain_id");
        const address = parsedUrl.searchParams.get("contract_address");
        if (chainId && address) {
          const descriptors = getStoredDescriptors();
          const key = `${chainId}:${address.toLowerCase()}`;
          console.log(`Intercepted dapps request for ${key}`);
          return JSON.stringify(descriptors[key]) || null;
        }
      } catch (error) {
        console.error("Failed to parse URL params:", error);
      }
      return null;
    },
    [getStoredDescriptors],
  );

  // Certificates interceptor
  const certificatesUrlPredicate = useCallback((url: string) => {
    try {
      const parsedUrl = new URL(url, window.location.origin);
      return (
        parsedUrl.origin.includes("crypto-assets-service") &&
        parsedUrl.pathname.includes("/certificates") &&
        parsedUrl.searchParams.get("output") === "descriptor"
      );
    } catch {
      return false;
    }
  }, []);

  const modifyCertificatesResponse = useCallback(
    (url: string) => {
      try {
        const parsedUrl = new URL(url, window.location.origin);
        const targetDevice = parsedUrl.searchParams.get("target_device");
        const publicKeyUsage = parsedUrl.searchParams.get("public_key_usage");
        const publicKeyId = parsedUrl.searchParams.get("public_key_id");

        if (targetDevice && publicKeyUsage && publicKeyId) {
          const certificates = getStoredCertificates();

          // Build the certificate key: target_device:public_key_id:public_key_usage
          const key = `${targetDevice}:${publicKeyId}:${publicKeyUsage}`;
          const certificate = certificates[key];
          if (certificate) {
            console.log(`Intercepted certificate request for ${key}`);
            return JSON.stringify(certificate);
          }
        }
      } catch (error) {
        console.error("Failed to parse certificate URL params:", error);
      }
      return null;
    },
    [getStoredCertificates],
  );

  useXhrInterceptor(calUrlPredicate, modifyCalResponse, isActive);
  useXhrInterceptor(
    certificatesUrlPredicate,
    modifyCertificatesResponse,
    isActive,
  );

  const contextValue: CalInterceptorContextType = {
    isActive,
    startInterception,
    stopInterception,
    storeDescriptor,
    storeCertificates,
    clearStoredDescriptors,
    getStoredDescriptorCount,
  };

  return (
    <CalInterceptorContext.Provider value={contextValue}>
      {children}
    </CalInterceptorContext.Provider>
  );
};

export const useCalInterceptor = (): CalInterceptorContextType => {
  return useContext(CalInterceptorContext);
};
