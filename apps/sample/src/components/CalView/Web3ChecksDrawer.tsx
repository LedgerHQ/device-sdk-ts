import React, { useCallback, useState } from "react";
import { type ContextModuleWeb3ChecksConfig } from "@ledgerhq/context-module";
import { Button, Divider, Flex } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import { CommandForm } from "@/components/CommandsView/CommandForm";
import { type FieldType } from "@/hooks/useForm";
import { useWeb3ChecksConfig } from "@/state/settings/hooks";

type Web3ChecksDrawerProps = {
  onClose: () => void;
};

export function Web3ChecksDrawer({ onClose }: Web3ChecksDrawerProps) {
  const { web3ChecksConfig, setWeb3ChecksConfig } = useWeb3ChecksConfig();
  const [values, setValues] =
    useState<Record<string, FieldType>>(web3ChecksConfig);
  const labelSelector: Record<string, string> = {
    url: "Web3checks provider URL",
  };

  const onSettingsUpdate = useCallback(() => {
    const { url } = values;

    console.log("Updating settings", values);
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      console.error("Invalid Web3Checks provider URL", url);
      return;
    }

    const newSettings: ContextModuleWeb3ChecksConfig = {
      url,
    };

    setWeb3ChecksConfig(newSettings);
    onClose();
  }, [onClose, setWeb3ChecksConfig, values]);

  return (
    <Block>
      <Flex flexDirection="column" rowGap={3}>
        <CommandForm
          initialValues={web3ChecksConfig}
          onChange={setValues}
          labelSelector={labelSelector}
        />
        <Divider />
      </Flex>
      <Flex flexDirection="row" flex={1} columnGap={3}>
        <Button variant="main" onClick={onSettingsUpdate}>
          Update settings
        </Button>
      </Flex>
    </Block>
  );
}
