import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CalInterceptor } from "@ledgerhq/cal-interceptor";

type CalInterceptorContextType = {
  isActive: boolean;
  startInterception: () => void;
  stopInterception: () => void;
  clearStoredDescriptors: () => void;
  getStoredDescriptorCount: () => number;
  interceptor: CalInterceptor | undefined;
};

const initialState: CalInterceptorContextType = {
  isActive: false,
  startInterception: () => {},
  stopInterception: () => {},
  clearStoredDescriptors: () => {},
  getStoredDescriptorCount: () => 0,
  interceptor: undefined,
};

const CalInterceptorContext =
  createContext<CalInterceptorContextType>(initialState);

// Utility to store CAL descriptors in the local storage,
// and intercept network calls to the CAL to serve local descriptors
// when available
export const CalInterceptorProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const interceptorRef = useRef<CalInterceptor>();
  const [isActive, setIsActive] = useState(false);

  // Initialize interceptor on mount
  useEffect(() => {
    interceptorRef.current = new CalInterceptor();
    return () => {
      interceptorRef.current?.stop();
    };
  }, []);

  // Start the CAL interceptor
  const startInterception = useCallback(() => {
    interceptorRef.current?.start();
    setIsActive(true);
  }, []);

  // Stop the CAL interceptor
  const stopInterception = useCallback(() => {
    interceptorRef.current?.stop();
    setIsActive(false);
  }, []);

  // Clear all the descriptors and certificates from the local storage
  const clearStoredDescriptors = useCallback(() => {
    interceptorRef.current?.clearStoredDescriptors();
  }, []);

  // Get the amount of descriptors available
  const getStoredDescriptorCount = useCallback((): number => {
    return interceptorRef.current?.getStoredDescriptorCount() ?? 0;
  }, []);

  const contextValue: CalInterceptorContextType = {
    isActive,
    startInterception,
    stopInterception,
    clearStoredDescriptors,
    getStoredDescriptorCount,
    interceptor: interceptorRef.current,
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
