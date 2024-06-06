import { useCallback, useState } from "react";

type ApduFormValues = {
  instructionClass: string;
  instructionMethod: string;
  firstParameter: string;
  secondParameter: string;
  data: string;
  dataLength: string;
};

export function useApduForm() {
  const [values, setValues] = useState<ApduFormValues>({
    instructionClass: "e0",
    instructionMethod: "01",
    firstParameter: "00",
    secondParameter: "00",
    dataLength: "00",
    data: "",
  });

  const setValue = useCallback((field: keyof ApduFormValues, value: string) => {
    const newValues = { [field]: value };
    if (field === "data") {
      newValues.dataLength = Math.floor(value.length / 2).toString(16);
    }
    setValues((prev) => ({ ...prev, ...newValues }));
  }, []);

  const getRawApdu = useCallback(
    (formValues: ApduFormValues): Uint8Array =>
      new Uint8Array(
        Object.values(formValues).reduce(
          (acc, curr) => [
            ...acc,
            ...chunkString(curr.replace(/\s/g, ""))
              .map((char) => Number(`0x${char}`))
              .filter((nbr) => !Number.isNaN(nbr)),
          ],
          Array<number>(),
        ),
      ),
    [],
  );

  const getHexString = useCallback((raw: Uint8Array): string => {
    return raw
      .reduce((acc, curr) => acc + " " + curr.toString(16).padStart(2, "0"), "")
      .toUpperCase();
  }, []);

  return {
    apduFormValues: values,
    setApduFormValue: setValue,
    getRawApdu,
    getHexString,
  };
}

const BYTE_SIZE = 2;

const chunkString = (str: string, size = BYTE_SIZE): string[] => {
  const numChunks = Math.ceil(str.length / size);
  const chunks = new Array<string>(numChunks);

  for (let i = 0, offset = 0; i < numChunks; ++i, offset += size) {
    chunks[i] = str.slice(offset, offset + size);
  }

  return chunks;
};
