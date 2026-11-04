import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectList,
  SelectTrigger,
  Switch as LumenSwitch,
  TextInput,
} from "@ledgerhq/lumen-ui-react";

type TextFieldProps = {
  label: string;
  /** Shown as a native tooltip. */
  hint?: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number" | "password";
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  tabIndex?: number;
  "data-testid"?: string;
};

export const Input: React.FC<TextFieldProps> = ({
  hint,
  onChange,
  value,
  ...props
}) => (
  <TextInput
    {...props}
    title={hint}
    value={value}
    onChange={(e) => onChange(e.target.value)}
  />
);

type Option<T extends string | number | boolean> = { label: string; value: T };

type SelectInputProps<T extends string | number | boolean> = {
  label: string;
  options: Array<Option<T>>;
  value?: Option<T> | null;
  onChange: (option: Option<T> | null) => void;
  isDisabled?: boolean;
  placeholder?: string;
  "data-testid"?: string;
};

/** Lumen selects only handle string values: they are mapped back to options. */
export function SelectInput<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
  isDisabled,
  "data-testid": testId,
}: SelectInputProps<T>) {
  const items = options.map((option) => ({
    value: String(option.value),
    label: option.label,
  }));
  return (
    <Select
      items={items}
      value={value ? String(value.value) : null}
      onValueChange={(selected) =>
        onChange(options.find((o) => String(o.value) === selected) ?? null)
      }
      disabled={isDisabled}
    >
      <SelectTrigger label={label} data-testid={testId} />
      <SelectContent>
        <SelectList
          renderItem={(item) => (
            <SelectItem key={item.value} value={item.value}>
              <SelectItemText>{item.label}</SelectItemText>
            </SelectItem>
          )}
        />
      </SelectContent>
    </Select>
  );
}

type SwitchProps = {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  name?: string;
  "data-testid"?: string;
};

export const Switch: React.FC<SwitchProps> = ({
  label,
  checked,
  onChange,
  disabled,
  name,
  "data-testid": testId,
}) => (
  <label
    className="body-2 flex cursor-pointer flex-row items-center gap-12 text-base"
    data-testid={testId}
  >
    <LumenSwitch
      name={name}
      selected={checked}
      onChange={onChange}
      disabled={disabled}
    />
    {label}
  </label>
);
