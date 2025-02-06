import { useCallback, useState } from "react";

export type FieldType = string | boolean | number;

export function useForm<T extends Record<string, string | boolean | number>>(
  initialValues: T,
) {
  const [formValues, setFormValues] = useState<T>(initialValues);

  const setFormValue = useCallback((field: keyof T, value: FieldType) => {
    const newValues = { [field]: value };
    setFormValues((prev) => ({ ...prev, ...newValues }));
  }, []);

  return {
    formValues,
    setFormValue,
    setFormValues,
  };
}
