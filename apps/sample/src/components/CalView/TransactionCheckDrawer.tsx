import React, { useCallback, useState } from "react";
import { type ContextModuleTransactionCheckConfig } from "@ledgerhq/context-module";
import { Button, Divider, Flex } from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import { CommandForm } from "@/components/CommandsView/CommandForm";
import { type FieldType } from "@/hooks/useForm";
import { useTransactionCheckConfig } from "@/providers/SignerEthProvider";

type TransactionCheckDrawerProps = {
  onClose: () => void;
};

export function TransactionCheckDrawer({
  onClose,
}: TransactionCheckDrawerProps) {
  const { transactionCheckConfig, setTransactionCheckConfig } =
    useTransactionCheckConfig();
  const [values, setValues] = useState<Record<string, FieldType>>(
    transactionCheckConfig,
  );
  const labelSelector: Record<string, string> = {
    url: "Transaction Check provider URL",
  };

  const onSettingsUpdate = useCallback(() => {
    const { url } = values;

    console.log("Updating settings", values);
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      console.error("Invalid Transaction Check provider URL", url);
      return;
    }

    const newSettings: ContextModuleTransactionCheckConfig = {
      url,
    };

    setTransactionCheckConfig(newSettings);
    onClose();
  }, [onClose, setTransactionCheckConfig, values]);

  return (
    <Block>
      <Flex flexDirection="column" rowGap={3}>
        <CommandForm
          initialValues={transactionCheckConfig}
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
