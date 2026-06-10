import React from "react";
import { type DeviceApp } from "@ledgerhq/device-mockserver-client";
import { Button, Flex, Input, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

import {
  connectivityTypeOptions,
  deviceTypeOptions,
  type Option,
} from "@/components/MockView/utils";

export type DeviceFormValues = {
  deviceType: string;
  connectivityType: string;
  firmwareVersion: string;
  apps: DeviceApp[];
};

/**
 * Drop rows without a name and trim the remaining values, producing the `apps`
 * payload sent to the mock server (or `undefined` when empty).
 */
export const cleanApps = (apps: DeviceApp[]): DeviceApp[] | undefined => {
  const cleaned = apps
    .map((app) => ({ name: app.name.trim(), version: app.version.trim() }))
    .filter((app) => app.name.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
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

const AppsField: React.FC<{
  apps: DeviceApp[];
  onChange: (apps: DeviceApp[]) => void;
}> = ({ apps, onChange }) => {
  const update = (index: number, patch: Partial<DeviceApp>) =>
    onChange(apps.map((app, i) => (i === index ? { ...app, ...patch } : app)));
  const remove = (index: number) =>
    onChange(apps.filter((_, i) => i !== index));
  const add = () => onChange([...apps, { name: "", version: "" }]);

  return (
    <Flex flexDirection="column">
      <FieldLabel>Installed apps</FieldLabel>
      <Flex flexDirection="column" rowGap={3}>
        {apps.map((app, index) => (
          <Flex
            key={index}
            flexDirection="row"
            columnGap={3}
            alignItems="center"
          >
            <Flex flex={2}>
              <Input
                name={`App name ${index}`}
                placeholder="Name (e.g. Bitcoin)"
                containerProps={inputContainerProps}
                value={app.name}
                onChange={(name) => update(index, { name })}
              />
            </Flex>
            <Flex flex={1}>
              <Input
                name={`App version ${index}`}
                placeholder="Version"
                containerProps={inputContainerProps}
                value={app.version}
                onChange={(version) => update(index, { version })}
              />
            </Flex>
            <Button
              variant="shade"
              outline
              onClick={() => remove(index)}
              data-testid={`remove-app-${index}`}
            >
              Remove
            </Button>
          </Flex>
        ))}
        <Flex alignSelf="flex-start">
          <Button variant="shade" outline onClick={add}>
            + Add app
          </Button>
        </Flex>
      </Flex>
    </Flex>
  );
};

export const DeviceForm: React.FC<DeviceFormProps> = ({ values, onChange }) => (
  <Flex flexDirection="column" rowGap={5}>
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

    <AppsField
      apps={values.apps}
      onChange={(apps) => onChange({ ...values, apps })}
    />
  </Flex>
);
