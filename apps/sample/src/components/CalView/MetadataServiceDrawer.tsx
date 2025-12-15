import React, { useCallback, useState } from "react";
import { type ContextModuleMetadataServiceConfig } from "@ledgerhq/context-module";
import { Button, Divider, Flex } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import { CommandForm } from "@/components/CommandsView/CommandForm";
import { type FieldType } from "@/hooks/useForm";
import { useMetadataServiceConfig } from "@/state/settings/hooks";

type MetadataServiceDrawerProps = {
  onClose: () => void;
};

export function MetadataServiceDrawer({ onClose }: MetadataServiceDrawerProps) {
  const { metadataServiceDomain, setMetadataServiceConfig } =
    useMetadataServiceConfig();
  const [values, setValues] = useState<Record<string, FieldType>>(
    metadataServiceDomain,
  );
  const labelSelector: Record<string, string> = {
    url: "Metadata Service URL",
  };

  const onSettingsUpdate = useCallback(() => {
    const { url } = values;

    console.log("Updating settings", values);
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      console.error("Invalid Metadata Service URL", url);
      return;
    }

    const newSettings: ContextModuleMetadataServiceConfig = {
      url,
    };

    setMetadataServiceConfig(newSettings);
    onClose();
  }, [onClose, setMetadataServiceConfig, values]);

  return (
    <Block>
      <Flex flexDirection="column" rowGap={3}>
        <CommandForm
          initialValues={metadataServiceDomain}
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
