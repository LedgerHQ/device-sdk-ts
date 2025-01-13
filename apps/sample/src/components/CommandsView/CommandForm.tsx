import React, { useEffect } from "react";
import {
  Flex,
  Grid,
  Input,
  SelectInput,
  Switch,
  Text,
} from "@ledgerhq/react-ui";
import styled from "styled-components";

import { type FieldType, useForm } from "@/hooks/useForm";

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

const GridContainer = styled(Grid)`
  max-height: 220px;
  overflow: scroll;
`;

const Item = styled(Flex).attrs({
  px: 4,
  py: 2,
})`
  flex-direction: column;
  flex: 1;
  justify-content: center;
  align-items: flex-start;
  min-height: 50px;
`;

export function CommandForm<Args extends Record<string, FieldType>>({
  initialValues,
  onChange,
  valueSelector,
  labelSelector,
  disabled,
  columns = 2,
}: {
  initialValues: Args;
  onChange: (values: Args) => void;
  valueSelector?: ValueSelector<FieldType>;
  labelSelector?: Record<string, string>;
  disabled?: boolean;
  columns?: number;
}) {
  const { formValues, setFormValue } = useForm(initialValues);

  useEffect(() => {
    onChange(formValues);
  }, [formValues, onChange]);

  if (!formValues) {
    return null;
  }

  return (
    <GridContainer columns={columns}>
      {Object.entries(formValues).map(([key, value]) => (
        <Item key={key}>
          {typeof value === "boolean" ? null : (
            <Text variant="paragraph" fontWeight="medium">
              {labelSelector && labelSelector[key] ? labelSelector[key] : key}
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
            <Switch
              data-testid={`input-switch_${key}`}
              name="key"
              checked={value}
              onChange={() => setFormValue(key, !value)}
              disabled={disabled}
              label={key}
            />
          ) : typeof value === "string" ? (
            <Input
              id={key}
              value={value}
              placeholder={key}
              onChange={(newVal) => setFormValue(key, newVal)}
              disabled={disabled}
              containerProps={{ style: { marginTop: "8px", width: "100%" } }}
              data-testid={`input-text_${key}`}
            />
          ) : (
            <Input
              id={key}
              value={value}
              placeholder={key}
              onChange={(newVal) =>
                setFormValue(key, parseInt(newVal.toString(), 10) ?? 0)
              }
              type="number"
              disabled={disabled}
            />
          )}
        </Item>
      ))}
    </GridContainer>
  );
}
