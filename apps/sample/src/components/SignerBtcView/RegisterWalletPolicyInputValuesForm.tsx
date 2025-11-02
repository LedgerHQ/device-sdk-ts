import React, { useEffect } from "react";
import { Flex, Input, Switch, Text } from "@ledgerhq/react-ui";

import { useForm } from "@/hooks/useForm";

type RegisterWalletPolicyInputValuesType = {
  name: string;
  descriptorTemplate: string;
  keys: string[];
  skipOpenApp: boolean;
};

export const RegisterWalletPolicyInputValuesForm: React.FC<{
  initialValues: RegisterWalletPolicyInputValuesType;
  onChange: (values: RegisterWalletPolicyInputValuesType) => void;
  disabled?: boolean;
}> = ({ initialValues, onChange, disabled }) => {
  const { formValues, setFormValue } = useForm(initialValues);

  useEffect(() => {
    onChange(formValues);
  }, [formValues, onChange]);

  return (
    <Flex flexDirection="column" rowGap={6}>
      <Input
        label="Policy name"
        value={formValues.name}
        onChange={(val) => setFormValue("name", val)}
        disabled={disabled}
      />

      <Flex flexDirection="column">
        <Text style={{ marginBottom: 8 }}>Descriptor Template</Text>
        <Input
          label="Description template"
          value={formValues.descriptorTemplate}
          onChange={(val) => setFormValue("descriptorTemplate", val)}
          disabled={disabled}
        />
      </Flex>

      <Flex flexDirection="column">
        <Text style={{ marginBottom: 8 }}>Keys (comma separated)</Text>
        <Input
          label="Keys"
          value={formValues.keys.join(", ")}
          onChange={(val) =>
            setFormValue(
              "keys",
              val.split(",").map((k) => k.trim()),
            )
          }
          disabled={disabled}
        />
      </Flex>

      <Switch
        label="Skip open app"
        name="skipOpenApp"
        checked={formValues.skipOpenApp}
        disabled={disabled}
        onChange={() => setFormValue("skipOpenApp", !formValues.skipOpenApp)}
      />
    </Flex>
  );
};
