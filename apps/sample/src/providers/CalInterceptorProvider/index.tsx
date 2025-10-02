import React, { createContext, useCallback, useContext, useState } from "react";

import { useXhrInterceptor } from "@/hooks/useXhrInterceptor";

const STORAGE_KEY = "erc7730_descriptors";

type CalInterceptorContextType = {
  isActive: boolean;
  startInterception: () => void;
  stopInterception: () => void;
  storeDescriptor: (
    chainId: number,
    address: string,
    descriptorData: unknown,
  ) => void;
  clearStoredDescriptors: () => void;
  getStoredDescriptorCount: () => number;
};

const initialState: CalInterceptorContextType = {
  isActive: false,
  startInterception: () => {},
  stopInterception: () => {},
  storeDescriptor: () => {},
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

  // Clear all the descriptors from the local storage
  const clearStoredDescriptors = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log("Cleared all stored descriptors");
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
          return JSON.stringify(descriptors[key]) || null;
        }
      } catch (error) {
        console.error("Failed to parse URL params:", error);
      }
      return null;
    },
    [getStoredDescriptors],
  );

  useXhrInterceptor(calUrlPredicate, modifyCalResponse, isActive);

  const contextValue: CalInterceptorContextType = {
    isActive,
    startInterception,
    stopInterception,
    storeDescriptor,
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
