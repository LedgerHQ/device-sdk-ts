import React, { createContext, useContext, useState } from "react";
import { SdkError } from "@ledgerhq/device-management-kit";
import { DeviceSelectionDrawer } from "@/components/MainView/DeviceSelectionDrawer";
import { Button, Flex, Icons, Text } from "@ledgerhq/react-ui";
import { Sidebar } from "@/components/Sidebar";

type DeviceSelectionContextType = {
  setError: (error: SdkError | null) => void;
  setVisibility: (visible: boolean) => void;
};

const DeviceSelectionContext = createContext<DeviceSelectionContextType>({
  setError: () => null,
  setVisibility: () => null,
});

export const DeviceSelectionProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [visible, setVisibility] = useState(false);
  const [error, setError] = useState<SdkError | null>(null);

  return (
    <DeviceSelectionContext.Provider value={{ setError, setVisibility }}>
      {error ? (
        <>
          <Sidebar />
          <Flex
            p={6}
            flex={1}
            alignItems="center"
            justifyContent="center"
            flexDirection="column"
            rowGap={6}
            alignSelf="center"
            width={400}
          >
            <Icons.DeleteCircleFill size="XL" color="error.c70" />
            <Text textAlign="center" fontSize={21} fontWeight="semiBold">
              Connection error
            </Text>
            <Text
              textAlign="center"
              mb={3}
              color="opacityDefault.c60"
              fontSize={14}
            >
              {error.message ||
                (error.originalError as Error | undefined)?.message ||
                "Unknown error"}
            </Text>
            <Button
              variant="main"
              onClick={() => {
                setError(null);
                setVisibility(true);
              }}
            >
              Retry
            </Button>
          </Flex>
        </>
      ) : (
        children
      )}
      <DeviceSelectionDrawer
        isOpen={visible}
        onClose={() => setVisibility(false)}
        onError={(error) => {
          if (error) {
            setVisibility(false);
          }
          setError(error);
        }}
      />
    </DeviceSelectionContext.Provider>
  );
};

export const useDeviceSelectionContext = () =>
  useContext<DeviceSelectionContextType>(DeviceSelectionContext);
