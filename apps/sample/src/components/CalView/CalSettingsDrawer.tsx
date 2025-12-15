import React, { useCallback, useState } from "react";
import { type ContextModuleCalConfig } from "@ledgerhq/context-module";
import { Button, Divider, Flex } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import {
  CommandForm,
  type ValueSelector,
} from "@/components/CommandsView/CommandForm";
import { type FieldType } from "@/hooks/useForm";
import { useCalConfig, useOriginToken } from "@/state/settings/hooks";

type CalSettingsDrawerProps = {
  onClose: () => void;
};

export function CalSettingsDrawer({ onClose }: CalSettingsDrawerProps) {
  const { calConfig, setCalConfig } = useCalConfig();
  const { originToken, setOriginToken } = useOriginToken();
  const [values, setValues] = useState<Record<string, FieldType>>({
    ...calConfig,
    originToken,
  });
  const valueSelector: ValueSelector<FieldType> = {
    mode: [
      { label: "Production", value: "prod" },
      { label: "Testing", value: "test" },
    ],
    branch: [
      { label: "Main", value: "main" },
      { label: "Next", value: "next" },
      { label: "Demo", value: "demo" },
    ],
  };
  const labelSelector: Record<string, string> = {
    url: "CAL URL",
    mode: "Mode",
    branch: "Branch reference",
    originToken: "Origin Token",
  };

  const onSettingsUpdate = useCallback(() => {
    const { url, mode, branch, originToken: token } = values;
    const isMode = (test: unknown): test is "prod" | "test" =>
      test === "prod" || test === "test";
    const isBranch = (test: unknown): test is "main" | "next" | "demo" =>
      test === "main" || test === "next" || test === "demo";

    console.log("Updating settings", values);
    if (!url || typeof url !== "string") {
      console.error("Invalid CAL URL", url);
      return;
    }

    if (!mode || !isMode(mode)) {
      console.error("Invalid mode", mode);
      return;
    }

    if (!branch || !isBranch(branch)) {
      console.error("Invalid branch reference", branch);
      return;
    }

    if (!token || typeof token !== "string") {
      console.error("Invalid origin token", token);
      return;
    }

    const newSettings: ContextModuleCalConfig = {
      url,
      mode,
      branch,
    };

    setCalConfig(newSettings);
    setOriginToken(token);
    onClose();
  }, [onClose, setCalConfig, setOriginToken, values]);

  return (
    <Block>
      <Flex flexDirection="column" rowGap={3}>
        <CommandForm
          initialValues={{ ...calConfig, originToken }}
          onChange={setValues}
          valueSelector={valueSelector}
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
