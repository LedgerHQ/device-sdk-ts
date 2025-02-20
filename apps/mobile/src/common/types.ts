import { DefaultTheme } from "styled-components/native";
import { FieldType } from "_hooks/useForm.tsx";
import React from "react";
import {
  CommandResult,
  DeviceActionIntermediateValue,
  DeviceModelId,
  DmkError,
  ExecuteDeviceActionReturnType,
} from "@ledgerhq/device-management-kit";

export type ThemeProps = {
  theme: DefaultTheme;
};

export type CommandProps<
  CommandArgs extends Record<string, FieldType> | void,
  Response,
  ErrorCodes = void,
> = {
  id: string;
  title: string;
  description: string;
  sendCommand: (
    args: CommandArgs,
  ) => Promise<CommandResult<Response, ErrorCodes>>;
  initialValues: CommandArgs;
  FormComponent: React.FC<{
    setValue: (field: keyof CommandArgs, value: FieldType) => void;
    values: CommandArgs;
  }>;
};

export type DeviceActionProps<
  Output,
  Input extends Record<string, FieldType> | void,
  Error extends DmkError,
  IntermediateValue extends DeviceActionIntermediateValue,
> = {
  id: string;
  title: string;
  description: string;
  executeDeviceAction: (
    args: Input,
    debug?: boolean,
  ) => ExecuteDeviceActionReturnType<Output, Error, IntermediateValue>;
  initialValues: Input;
  FormComponent: React.FC<{
    setValue: (field: keyof Input, value: FieldType) => void;
    values: Input;
  }>;
  deviceModelId: DeviceModelId;
};
