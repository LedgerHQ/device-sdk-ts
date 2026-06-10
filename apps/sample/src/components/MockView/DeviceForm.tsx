import React from "react";
import { Flex, Input, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import {
  connectivityTypeOptions,
  deviceTypeOptions,
  type Option,
} from "@/components/MockView/utils";

export type DeviceFormValues = {
  name: string;
  deviceType: string;
  connectivityType: string;
  firmwareVersion: string;
};

type DeviceFormProps = {
  values: DeviceFormValues;
  onChange: (values: DeviceFormValues) => void;
};

const inputContainerProps = { style: { borderRadius: 4 } };

const FieldLabel: React.FC<{ children: string }> = ({ children }) => (
  <Text variant="small" color="neutral.c70" mb={2}>
    {children}
  </Text>
);

const NativeSelect = styled.select`
  height: 40px;
  padding: 0 12px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.colors.neutral.c40};
  background-color: ${({ theme }) => theme.colors.background.main};
  color: ${({ theme }) => theme.colors.neutral.c100};
  font-family: "Inter", sans-serif;
  font-size: 14px;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.neutral.c100};
  }
`;

const SelectField: React.FC<{
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => (
  <Flex flexDirection="column">
    <FieldLabel>{label}</FieldLabel>
    <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  </Flex>
);

export const DeviceForm: React.FC<DeviceFormProps> = ({ values, onChange }) => (
  <Flex flexDirection="column" rowGap={5}>
    <Flex flexDirection="column">
      <FieldLabel>Name</FieldLabel>
      <Input
        name="Name"
        containerProps={inputContainerProps}
        value={values.name}
        onChange={(name) => onChange({ ...values, name })}
      />
    </Flex>

    <SelectField
      label="Device type"
      value={values.deviceType}
      options={deviceTypeOptions}
      onChange={(deviceType) => onChange({ ...values, deviceType })}
    />

    <SelectField
      label="Connectivity"
      value={values.connectivityType}
      options={connectivityTypeOptions}
      onChange={(connectivityType) => onChange({ ...values, connectivityType })}
    />

    <Flex flexDirection="column">
      <FieldLabel>Firmware version</FieldLabel>
      <Input
        name="Firmware version"
        containerProps={inputContainerProps}
        value={values.firmwareVersion}
        onChange={(firmwareVersion) => onChange({ ...values, firmwareVersion })}
      />
    </Flex>
  </Flex>
);
