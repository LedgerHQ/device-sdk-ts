import React, { useCallback, useEffect, useState } from "react";
import { Flex, Input, SelectInput, Switch } from "@ledgerhq/react-ui";

import { InputLabel, SelectInputLabel } from "@/components/InputLabel";
import { type FieldType, useForm } from "@/hooks/useForm";

export type ValueSelector<T extends FieldType> = Record<
  string,
  Array<{
    label: string;
    value: T;
  }>
>;

export type LinkedFields<Args extends Record<string, FieldType>> = {
  [K in keyof Args]?: (
    newValue: FieldType,
    currentValues: Args,
  ) => Partial<Args>;
};

export type HintSelector<Args extends Record<string, FieldType>> = {
  [K in keyof Args]?: (value: Args[K]) => React.ReactNode;
};

export function getValueSelectorFromEnum<
  T extends Record<string, string | number>,
>(enumObject: T) {
  const entries = Object.entries(enumObject);
  const res = entries.slice(entries.length / 2).map(([key, value]) => ({
    label: key,
    value,
  }));
  return res;
}

// Every form in apps/sample is a dev/test harness for DMK device actions,
// never a credential entry point. Tell password managers (1Password,
// LastPass, Bitwarden) to ignore these inputs — otherwise buttons labeled
// "Register…" / "Sign…" trigger the autofill or capture popup.
const PASSWORD_MANAGER_OPT_OUT = {
  autoComplete: "off",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
} as const;

type FormFieldProps = {
  fieldKey: string;
  value: FieldType;
  label: string;
  defaultValue: FieldType;
  options?: Array<{ label: string; value: FieldType }>;
  disabled?: boolean;
  onChange: (key: string, value: FieldType) => void;
};

const FormField: React.FC<FormFieldProps> = ({
  fieldKey,
  value,
  label,
  defaultValue,
  options,
  disabled,
  onChange,
}) => {
  if (options) {
    return (
      <Flex flexDirection="column" alignItems="stretch">
        <SelectInput
          renderLeft={() => <SelectInputLabel>{label}</SelectInputLabel>}
          isDisabled={disabled}
          placeholder={String(defaultValue)}
          value={options.find((val) => val.value === value)}
          isMulti={false}
          onChange={(newVal) => newVal && onChange(fieldKey, newVal.value)}
          options={options}
          isSearchable={false}
        />
      </Flex>
    );
  }

  if (typeof value === "boolean") {
    return (
      <div data-testid={`input-switch_${fieldKey}`}>
        <Switch
          name={fieldKey}
          checked={value}
          onChange={() => onChange(fieldKey, !value)}
          disabled={disabled}
          label={label}
        />
      </div>
    );
  }

  if (typeof value === "string") {
    return (
      <Input
        id={fieldKey}
        renderLeft={() => <InputLabel>{label}</InputLabel>}
        value={value}
        placeholder={String(defaultValue)}
        onChange={(newVal) => onChange(fieldKey, newVal)}
        disabled={disabled}
        data-testid={`input-text_${fieldKey}`}
        {...PASSWORD_MANAGER_OPT_OUT}
      />
    );
  }

  return (
    <Input
      id={fieldKey}
      renderLeft={() => <InputLabel>{label}</InputLabel>}
      value={value}
      placeholder={String(defaultValue)}
      onChange={(newVal) =>
        onChange(fieldKey, parseInt(newVal.toString(), 10) ?? 0)
      }
      type="number"
      disabled={disabled}
      {...PASSWORD_MANAGER_OPT_OUT}
    />
  );
};

export function Form<Args extends Record<string, FieldType>>({
  initialValues,
  onChange,
  valueSelector,
  labelSelector,
  linkedFields,
  hintSelector,
  disabled,
  className,
}: {
  initialValues: Args;
  onChange: (values: Args) => void;
  valueSelector?: ValueSelector<FieldType>;
  labelSelector?: Partial<Record<string, string>>;
  linkedFields?: LinkedFields<Args>;
  hintSelector?: HintSelector<Args>;
  disabled?: boolean;
  className?: string;
}) {
  const { formValues, setFormValue, setFormValues } = useForm(initialValues);

  const [actualInitialValues] = useState(initialValues);

  useEffect(() => {
    onChange(formValues);
  }, [formValues, onChange]);

  const handleFieldChange = useCallback(
    (key: string, value: FieldType) => {
      const linkedHandler = linkedFields?.[key];
      if (linkedHandler) {
        const linkedUpdates = linkedHandler(
          value as Args[typeof key],
          formValues,
        );
        setFormValues((prev) => ({ ...prev, [key]: value, ...linkedUpdates }));
      } else {
        setFormValue(key, value);
      }
    },
    [linkedFields, formValues, setFormValue, setFormValues],
  );

  if (!formValues) return null;

  return (
    <Flex
      className={className}
      flexDirection="column"
      flexWrap="wrap"
      rowGap={5}
      columnGap={5}
    >
      {Object.entries(formValues).map(([key, value]) => {
        const hintFn = hintSelector?.[key as keyof Args];
        const hint = hintFn ? hintFn(value as Args[keyof Args]) : null;
        return (
          <Flex key={key} flexDirection="column" rowGap={1}>
            <FormField
              fieldKey={key}
              value={value}
              defaultValue={actualInitialValues[key]}
              label={labelSelector?.[key] ?? key}
              options={valueSelector?.[key]}
              disabled={disabled}
              onChange={handleFieldChange}
            />
            {hint}
          </Flex>
        );
      })}
    </Flex>
  );
}
