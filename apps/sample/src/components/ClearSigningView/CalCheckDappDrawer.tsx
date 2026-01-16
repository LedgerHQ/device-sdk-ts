import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import {
  Button,
  Divider,
  Flex,
  Icons,
  InfiniteLoader,
} from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import { Form, type ValueSelector } from "@/components/Form";
import { type FieldType } from "@/hooks/useForm";
import { selectCalBranch, selectCalUrl } from "@/state/settings/selectors";

import { CalAvailabilityResponseComponent } from "./CalAvailabilityResponse";
import {
  checkContractAvailability,
  type Descriptor,
} from "./CalNetworkDataSource";

export type CalCheckDappDrawerProps<
  _,
  Input extends Record<string, FieldType> | void,
> = {
  title: string;
  description: string;
  initialValues: Input;
  validateValues?: (args: Input) => boolean;
  valueSelector?: ValueSelector<FieldType>;
};

type Response = {
  searchAddress: string;
  date: Date;
  responseType: string;
  result: Descriptor[]; // Store the result from the API
  loading: false;
  id: number;
};

export function CalCheckDappDrawer<
  Output,
  Input extends Record<string, FieldType>,
>(props: CalCheckDappDrawerProps<Output, Input>) {
  const { initialValues, valueSelector, validateValues } = props;

  const nonce = useRef(-1);
  const [values, setValues] = useState<Input>(initialValues);
  const [valuesInvalid, setValuesInvalid] = useState<boolean>(false);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(false);
  const calUrl = useSelector(selectCalUrl);
  const calBranch = useSelector(selectCalBranch);
  const handleClickExecute = useCallback(() => {
    setLoading(true);
    const id = ++nonce.current;

    const fetchData = async () => {
      try {
        console.log("Trigger Request to checkContractAvailability");

        const response = await checkContractAvailability(
          values.smartContractAddress.toString(),
          calUrl,
          calBranch,
        );

        setResponses((prev) => [
          ...prev,
          {
            searchAddress: values.smartContractAddress.toString(),
            date: new Date(),
            responseType: response.responseType,
            result: response.descriptors, // Store the result from the API
            loading: false,
            id,
          },
        ]);

        setLoading(false);
      } catch (_error) {
        setLoading(false);
      }
    };

    fetchData();
  }, [values, calUrl, calBranch]);

  const handleClickClear = useCallback(() => {
    setResponses([]);
  }, []);

  const responseBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (responseBoxRef.current) {
      responseBoxRef.current.scrollTop = responseBoxRef.current.scrollHeight;
    }
  }, [responses]);

  useEffect(() => {
    if (validateValues) {
      setValuesInvalid(!validateValues(values));
    }
  }, [validateValues, values]);

  return (
    <>
      <Block>
        <Flex flexDirection="column" opacity={loading ? 0.5 : 1} rowGap={3}>
          <Form
            initialValues={values}
            onChange={setValues}
            valueSelector={valueSelector}
            disabled={loading}
          />
          <Divider />
        </Flex>
        <Flex flexDirection="row" flex={1} columnGap={3}>
          <Button
            variant="main"
            onClick={handleClickExecute}
            disabled={loading || valuesInvalid}
            Icon={() =>
              loading ? <InfiniteLoader size={20} /> : <Icons.ArrowRight />
            }
          >
            Check Availability
          </Button>
        </Flex>
      </Block>
      <Block flex={1} overflowY="hidden">
        <Flex
          ref={responseBoxRef}
          flexDirection="column"
          rowGap={4}
          flex={1}
          overflowY="scroll"
        >
          {responses.slice().map((response, key) => (
            <CalAvailabilityResponseComponent
              key={key}
              type={response.responseType}
              date={response.date}
              loading={response.loading}
              descriptors={response.result}
              searchAddress={response.searchAddress}
            />
          ))}
        </Flex>
        <Button
          variant="main"
          outline
          onClick={handleClickClear}
          disabled={responses.length === 0}
        >
          Clear responses
        </Button>
      </Block>
    </>
  );
}
