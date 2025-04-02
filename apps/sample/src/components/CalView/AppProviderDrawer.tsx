import React, { useCallback, useState } from "react";
import { Button, Divider, Flex } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import { CommandForm } from "@/components/CommandsView/CommandForm";
import { type FieldType } from "@/hooks/useForm";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

type AppProviderDrawerProps = {
  onClose: () => void;
};

export function AppProviderDrawer({ onClose }: AppProviderDrawerProps) {
  const dmk = useDmk();

  const currentProvider = dmk.getProvider();

  const defaultProviderData = { provider: currentProvider };

  const [values, setValues] =
    useState<Record<string, FieldType>>(defaultProviderData);

  const labelSelector: Record<string, string> = {
    provider: "App provider",
  };

  const onSettingsUpdate = useCallback(() => {
    const { provider } = values;

    if (
      provider === undefined ||
      typeof provider !== "number" ||
      provider < 1
    ) {
      console.error("Invalid App provider", provider);
      return;
    }

    dmk.setProvider(provider);
    onClose();
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
