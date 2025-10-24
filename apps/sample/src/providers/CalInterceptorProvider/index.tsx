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

        // Expect descriptorData to be an array with one element
        if (Array.isArray(descriptorData) && descriptorData.length > 0) {
          const newDescriptor = descriptorData[0];
          const existing = descriptors[key];

          // If there's existing data, merge the descriptor objects
          if (existing && Array.isArray(existing) && existing.length > 0) {
            const existingDescriptor = existing[0];
            // Merge the two descriptor objects (e.g., descriptors_calldata + descriptors_eip712)
            descriptors[key] = [
              {
                ...existingDescriptor,
                ...newDescriptor,
              },
            ];
            console.log(`Merged descriptors for ${chainId}:${address}`);
          } else {
            // No existing data, store as-is
            descriptors[key] = descriptorData;
            console.log(`Stored new descriptors for ${chainId}:${address}`);
          }

          localStorage.setItem(STORAGE_KEY, JSON.stringify(descriptors));
        } else {
          console.error("Empty descriptor data, nothing to store");
        }
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
  const modifyCalResponse = useCallback(
    (url: string) => {
      try {
        const parsedUrl = new URL(url, window.location.origin);

        // Check if it's a CAL request
        if (!parsedUrl.origin.includes("crypto-assets-service")) {
          return null;
        }

        // Handle dapps requests (descriptors_calldata / descriptors_eip712)
        if (parsedUrl.pathname.includes("/dapps")) {
          const output = parsedUrl.searchParams.get("output");
          if (
            output === "descriptors_calldata" ||
            output === "descriptors_eip712"
          ) {
            const chainId = parsedUrl.searchParams.get("chain_id");
            // Get address from contract_address or contracts parameter
            let address = parsedUrl.searchParams.get("contract_address");
            if (!address) {
              address = parsedUrl.searchParams.get("contracts");
            }

            if (chainId && address) {
              const descriptors = getStoredDescriptors();
              const key = `${chainId}:${address.toLowerCase()}`;
              const storedData = descriptors[key];

              if (
                storedData &&
                Array.isArray(storedData) &&
                storedData.length > 0
              ) {
                const descriptorObj = storedData[0];
                if (descriptorObj && output in descriptorObj) {
                  console.log(
                    `Intercepted dapps request for ${key} (${output})`,
                  );
                  return JSON.stringify([{ [output]: descriptorObj[output] }]);
                }
              }
            }
          }
        }

        // Handle certificates requests
        if (
          parsedUrl.pathname.includes("/certificates") &&
          parsedUrl.searchParams.get("output") === "descriptor"
        ) {
          const targetDevice = parsedUrl.searchParams.get("target_device");
          const publicKeyUsage = parsedUrl.searchParams.get("public_key_usage");
          const publicKeyId = parsedUrl.searchParams.get("public_key_id");

          if (targetDevice && publicKeyUsage && publicKeyId) {
            const certificates = getStoredCertificates();
            const key = `${targetDevice}:${publicKeyId}:${publicKeyUsage}`;
            const certificate = certificates[key];
            if (certificate) {
              console.log(`Intercepted certificate request for ${key}`);
              return JSON.stringify(certificate);
            }
          }
        }
      } catch (error) {
        console.error("Failed to parse URL params:", error);
      }
      return null;
    },
    [getStoredDescriptors, getStoredCertificates],
  );

  useXhrInterceptor(modifyCalResponse, isActive);

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
