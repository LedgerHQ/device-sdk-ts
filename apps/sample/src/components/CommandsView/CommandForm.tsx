import React, { useEffect } from "react";
import { Input, Flex, Switch, Text, SelectInput } from "@ledgerhq/react-ui";
import { useForm, FieldType } from "@/hooks/useForm";

export type ValueSelector<T extends FieldType> = Record<
  string,
  Array<{
    label: string;
    value: T;
  }>
>;

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

export function CommandForm<Args extends Record<string, FieldType>>({
  initialValues,
  onChange,
  valueSelector,
  disabled,
}: {
  initialValues: Args;
  onChange: (values: Args) => void;
  valueSelector?: ValueSelector<FieldType>;
  disabled?: boolean;
}) {
  const { formValues, setFormValue } = useForm(initialValues);

  useEffect(() => {
    onChange(formValues);
  }, [formValues, onChange]);

  if (!formValues) return null;

  return (
    <Flex flexDirection="column" flexWrap="wrap" rowGap={5} columnGap={5}>
      {Object.entries(formValues).map(([key, value]) => (
        <Flex
          flexDirection="column"
          key={key}
          alignItems="flex-start"
          rowGap={3}
          columnGap={3}
        >
          {typeof value === "boolean" ? null : (
            <Text variant="paragraph" fontWeight="medium">
              {key}
            </Text>
          )}
          {valueSelector?.[key] ? (
            <Flex flexDirection="row" flexWrap="wrap" rowGap={2} columnGap={2}>
              <SelectInput
                isDisabled={disabled}
                placeholder={key}
                value={valueSelector[key].find((val) => val.value === value)}
                isMulti={false}
                onChange={(newVal) => newVal && setFormValue(key, newVal.value)}
                options={valueSelector[key]}
                isSearchable={false}
              />
            </Flex>
          ) : typeof value === "boolean" ? (
            <div data-testid={`input-switch_${key}`}>
              <Switch
                name="key"
                checked={value}
                onChange={() => setFormValue(key, !value)}
                disabled={disabled}
                label={key}
              />
            </div>
          ) : typeof value === "string" ? (
            <Input
              id={key}
              value={value}
              placeholder={key}
              onChange={(newVal) => setFormValue(key, newVal)}
              disabled={disabled}
              data-testid={`input-text_${key}`}
            />
          ) : (
            <Input
              id={key}
              value={value}
              placeholder={key}
              onChange={(newVal) => setFormValue(key, newVal ?? 0)}
              type="number"
              disabled={disabled}
            />
          )}
        </Flex>
      ))}
    </Flex>
  );
}
