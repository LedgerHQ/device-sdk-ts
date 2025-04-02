import React, { useCallback, useState } from "react";
import { Button, Divider, Flex } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import { CommandForm } from "@/components/CommandsView/CommandForm";
import { type FieldType } from "@/hooks/useForm";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

type AppProviderDrawerProps = {
  onClose: () => void;
};

const isDeviceManagementKit = (
  obj: unknown,
): obj is {
  getProvider: () => number;
  setProvider: (provider: number) => void;
} =>
  typeof obj === "object" &&
  obj !== null &&
  "getProvider" in obj &&
  typeof (obj as { getProvider: unknown }).getProvider === "function" &&
  "setProvider" in obj &&
  typeof (obj as { setProvider: unknown }).setProvider === "function";

export function AppProviderDrawer({ onClose }: AppProviderDrawerProps) {
  const dmk = useDmk();

  const currentProvider = isDeviceManagementKit(dmk) ? dmk.getProvider() : 1;

  if (!isDeviceManagementKit(dmk)) {
    console.error("Device management kit error", dmk);
  }

  const defaultProviderData = { provider: currentProvider };

  const [values, setValues] =
    useState<Record<string, FieldType>>(defaultProviderData);

  const labelSelector: Record<string, string> = {
    provider: "App provider ",
  };

  const onSettingsUpdate = useCallback(() => {
    const { provider } = values;

    if (provider === undefined || typeof provider !== "number") {
      console.error("Invalid App provider", provider);
      return;
    }

    if (isDeviceManagementKit(dmk)) {
      dmk.setProvider(provider);
      onClose();
    } else {
      console.error("Device management kit error", dmk);
    }
  }, [values, dmk, onClose]);

  return (
    <Block>
      <Flex flexDirection="column" rowGap={3}>
        <CommandForm
          initialValues={defaultProviderData}
          onChange={setValues}
          labelSelector={labelSelector}
        />
        <Divider />
      </Flex>
      <Flex flexDirection="row" flex={1} columnGap={3}>
        <Button variant="main" onClick={onSettingsUpdate}>
          Update provider
        </Button>
      </Flex>
    </Block>
  );
}
