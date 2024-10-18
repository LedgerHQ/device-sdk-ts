import React, { useCallback, useState } from "react";
import { ContextModuleCalConfig } from "@ledgerhq/context-module";
import { Button, Divider, Flex } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import {
  CommandForm,
  ValueSelector,
} from "@/components/CommandsView/CommandForm";
import { FieldType } from "@/hooks/useForm";

const INITIAL_VALUES = {
  calUrl: "https://cal.ledger.com",
  mode: "prod",
  branchRef: "main",
};

export function CalSettingsDrawer() {
  const [values, setValues] =
    useState<Record<string, FieldType>>(INITIAL_VALUES);
  const valueSelector: ValueSelector<FieldType> = {
    mode: [
      { label: "Production", value: "prod" },
      { label: "Testing", value: "test" },
    ],
    branchRef: [
      { label: "Main", value: "main" },
      { label: "Next", value: "next" },
      { label: "Demo", value: "demo" },
    ],
  };
  const labelSelector: Record<string, string> = {
    calUrl: "CAL URL",
    mode: "Mode",
    branchRef: "Branch reference",
  };

  const onSettingsUpdate = useCallback(() => {
    console.log("Settings updated", values);
  }, [values]);

  return (
    <Block>
      <Flex flexDirection="column" rowGap={3}>
        <CommandForm
          initialValues={INITIAL_VALUES}
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
