import { createContext, useContext, useEffect, useState } from "react";
import {
  BuiltinTransports,
  ConsoleLogger,
  DeviceSdk,
  DeviceSdkBuilder,
} from "@ledgerhq/device-sdk-core";
import { useMockServerContext } from "@/providers/MockServerProvider";

const defaultSdk = new DeviceSdkBuilder()
  .addLogger(new ConsoleLogger())
  .addTransport(BuiltinTransports.USB)
  .build();

const SdkContext = createContext<DeviceSdk>(defaultSdk);

type Props = {
  children: React.ReactNode;
};

export const SdkProvider: React.FC<Props> = ({ children }) => {
  const {
    state: { enabled: mockServerEnabled, url },
  } = useMockServerContext();
  const [sdk, setSdk] = useState<DeviceSdk>(defaultSdk);
  useEffect(() => {
    if (mockServerEnabled) {
      sdk.close();
      setSdk(
        new DeviceSdkBuilder()
          .addLogger(new ConsoleLogger())
          .addTransport(BuiltinTransports.MOCK_SERVER)
          .addConfig({ mockUrl: url })
          .build(),
      );
    } else {
      sdk.close();
      setSdk(defaultSdk);
    }
  }, [mockServerEnabled, url]);

  if (sdk) {
    return <SdkContext.Provider value={sdk}>{children}</SdkContext.Provider>;
  }
  return null;
};

export const useSdk = (): DeviceSdk => {
  return useContext(SdkContext);
};
