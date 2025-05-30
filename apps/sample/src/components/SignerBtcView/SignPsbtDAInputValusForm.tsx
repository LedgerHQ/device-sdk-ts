import React, { useCallback, useEffect } from "react";
import { DefaultDescriptorTemplate } from "@ledgerhq/device-signer-kit-bitcoin";
import { Flex, Input, SelectInput, Switch, Text } from "@ledgerhq/react-ui";

import { useForm } from "@/hooks/useForm";

type SignPsbtInputValuesType = {
  psbt: string;
  path: string;
  descriptorTemplate: DefaultDescriptorTemplate;
  skipOpenApp: boolean;
};

type GetWalletAddressInputValuesType = {
  checkOnDevice: boolean;
  change: boolean;
  addressIndex: number;
  derivationPath: string;
  descriptorTemplate: DefaultDescriptorTemplate;
  skipOpenApp: boolean;
};

export const descriptorTemplateToDerivationPath: Record<
  DefaultDescriptorTemplate,
  string
> = {
  [DefaultDescriptorTemplate.TAPROOT]: "86'/0'/0'",
  [DefaultDescriptorTemplate.NATIVE_SEGWIT]: "84'/0'/0'",
  [DefaultDescriptorTemplate.NESTED_SEGWIT]: "49'/0'/0'",
  [DefaultDescriptorTemplate.LEGACY]: "44'/0'/0'",
};

const descriptorTemplateToLabel = {
  [DefaultDescriptorTemplate.TAPROOT]: "Taproot",
  [DefaultDescriptorTemplate.NATIVE_SEGWIT]: "Native Segwit",
  [DefaultDescriptorTemplate.NESTED_SEGWIT]: "Nested Segwit",
  [DefaultDescriptorTemplate.LEGACY]: "Legacy",
};

export const SignPsbtDAInputValuesForm: React.FC<{
  initialValues: SignPsbtInputValuesType;
  onChange: (values: SignPsbtInputValuesType) => void;
  disabled?: boolean;
}> = ({ initialValues, onChange, disabled }) => {
  const { formValues, setFormValues, setFormValue } = useForm(initialValues);

  useEffect(() => {
    onChange(formValues);
  }, [formValues, onChange]);

  const onWalletDescriptorTemplateChange = useCallback(
    (value: DefaultDescriptorTemplate) => {
      const newValues = {
        path: descriptorTemplateToDerivationPath[value],
        descriptorTemplate: value,
      };
      setFormValues((prev) => ({ ...prev, ...newValues }));
    },
    [setFormValues],
  );

  return (
    <Flex
      flexDirection="column"
      flex={1}
      rowGap={6}
      columnGap={6}
      flexWrap="wrap"
    >
      <Flex flexDirection="row" alignItems="center" mb={4}>
        <Text style={{ marginRight: 8 }}>Wallet address type</Text>
        <SelectInput
          options={Object.entries(DefaultDescriptorTemplate).map(
            ([_key, value]) => ({
              label: descriptorTemplateToLabel[value],
              value,
            }),
          )}
          value={{
            label: descriptorTemplateToLabel[formValues.descriptorTemplate],
            value: formValues.descriptorTemplate,
          }}
          isMulti={false}
          isSearchable={false}
          onChange={(newVal) =>
            newVal && onWalletDescriptorTemplateChange(newVal.value)
          }
        />
      </Flex>

      <Input
        id="path"
        value={formValues.path}
        placeholder="path"
        onChange={(newVal) => setFormValue("path", newVal)}
        disabled={disabled}
        data-testid="input-text_path"
      />

      <Input
        id="psbt"
        value={formValues.psbt}
        placeholder="psbt"
        onChange={(newVal) => setFormValue("psbt", newVal)}
        disabled={disabled}
        data-testid="input-text_psbt"
      />

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

export const GetWalletAddressInputValuesForm: React.FC<{
  initialValues: GetWalletAddressInputValuesType;
  onChange: (values: GetWalletAddressInputValuesType) => void;
  disabled?: boolean;
}> = ({ initialValues, onChange, disabled }) => {
  const { formValues, setFormValues, setFormValue } = useForm(initialValues);

  useEffect(() => {
    onChange(formValues);
  }, [formValues, onChange]);

  const onWalletDescriptorTemplateChange = useCallback(
    (value: DefaultDescriptorTemplate) => {
      const newValues = {
        derivationPath: descriptorTemplateToDerivationPath[value],
        descriptorTemplate: value,
      };
      setFormValues((prev) => ({ ...prev, ...newValues }));
    },
    [setFormValues],
  );

  return (
    <Flex flexDirection="column" rowGap={6}>
      <Flex flexDirection="row" alignItems="center" mb={4}>
        <Text style={{ marginRight: 8 }}>Wallet address type</Text>
        <SelectInput
          options={Object.entries(DefaultDescriptorTemplate).map(
            ([_key, value]) => ({
              label: descriptorTemplateToLabel[value],
              value,
            }),
          )}
          value={{
            label: descriptorTemplateToLabel[formValues.descriptorTemplate],
            value: formValues.descriptorTemplate,
          }}
          isMulti={false}
          isSearchable={false}
          onChange={(newVal) =>
            newVal && onWalletDescriptorTemplateChange(newVal.value)
          }
        />
      </Flex>

      <Input
        label="Derivation path"
        value={formValues.derivationPath}
        onChange={(val) => setFormValue("derivationPath", val)}
        disabled={disabled}
      />

      <Text variant="paragraph" fontWeight="medium">
        {"Address index"}
      </Text>
      <Input
        label="Address index"
        value={String(formValues.addressIndex)}
        onChange={(val) => setFormValue("addressIndex", val)}
        disabled={disabled}
      />

      <Switch
        label="Change address"
        name="change"
        checked={formValues.change}
        disabled={disabled}
        onChange={() => setFormValue("change", !formValues.change)}
      />

      <Switch
        label="Check on device"
        name="checkOnDevice"
        checked={formValues.checkOnDevice}
        disabled={disabled}
        onChange={() =>
          setFormValue("checkOnDevice", !formValues.checkOnDevice)
        }
      />

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
