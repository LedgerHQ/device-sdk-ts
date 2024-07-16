import { createContext, useContext, useEffect, useState } from "react";
import {
  BuiltinTransport,
  ConsoleLogger,
  DeviceSdk,
  DeviceSdkBuilder,
} from "@ledgerhq/device-sdk-core";
import { useMockServerContext } from "@/providers/MockServerProvider";

const defaultSdk = new DeviceSdkBuilder()
  .addLogger(new ConsoleLogger())
  .addTransport(BuiltinTransport.USB)
  .build();

const SdkContext = createContext<DeviceSdk>(defaultSdk);

type Props = {
  children: React.ReactNode;
};

export const SdkProvider: React.FC<Props> = ({ children }) => {
  const {
    state: { enabled: mockServerEnabled },
  } = useMockServerContext();
  const [sdk, setSdk] = useState<DeviceSdk>(defaultSdk);
  useEffect(() => {
    if (mockServerEnabled) {
      setSdk(
        new DeviceSdkBuilder()
          .addLogger(new ConsoleLogger())
          .addTransport(BuiltinTransport.MOCK_SERVER)
          .build(),
      );
    } else {
      setSdk(defaultSdk);
    }
  }, [mockServerEnabled]);

  if (sdk) {
    return <SdkContext.Provider value={sdk}>{children}</SdkContext.Provider>;
  }
  return null;
};

export const useSdk = (): DeviceSdk => {
  return useContext(SdkContext);
};
