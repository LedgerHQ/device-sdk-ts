import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Divider,
  Flex,
  Grid,
  Icons,
  InfiniteLoader,
} from "@ledgerhq/react-ui";

import { Block } from "@/components/Block";
import { ClickableListItem } from "@/components/ClickableListItem";
import {
  CommandForm,
  ValueSelector,
} from "@/components/CommandsView/CommandForm";
import { PageWithHeader } from "@/components/PageWithHeader";
import { StyledDrawer } from "@/components/StyledDrawer";
import { FieldType } from "@/hooks/useForm";

import { CalAvailabilityResponseComponent } from "./CalAvailabilityResponse";
import { checkContractAvailability, Descriptor } from "./CalNetworkDataSource";

const CAL_SERVICE_ENTRIES = [
  {
    title: "Check dApp availability",
    description: "Check dApp availability in Crypto Asset List",
  },
];

export type CalActionProps<
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

export function CalActionDrawer<
  Output,
  Input extends Record<string, FieldType>,
>(props: CalActionProps<Output, Input>) {
  const { initialValues, valueSelector, validateValues } = props;

  const nonce = useRef(-1);
  const [values, setValues] = useState<Input>(initialValues);
  const [valuesInvalid, setValuesInvalid] = useState<boolean>(false);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(false);
  const handleClickExecute = useCallback(() => {
    setLoading(true);
    const id = ++nonce.current;

    const fetchData = async () => {
      try {
        console.log("Trigger Request to checkContractAvailability");

        const response = await checkContractAvailability(
          values.smartContractAddress.toString(),
          values.calUrl.toString(),
          values.branch.toString(),
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
  }, [values]);

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
        <Flex
          flexDirection="column"
          opacity={loading ? 0.5 : 1}
          rowGap={3}
          pointerEvents={loading ? "none" : "auto"}
        >
          <CommandForm
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

export const CalView = () => {
  const [isOpen, setIsOpen] = useState(false);
  const openDrawer = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  const title = "Check dApp availability";
  const description = "Check descriptor availability on the CAL";

  return (
    <PageWithHeader title="Crypto Assets">
      <Grid columns={1}>
        {CAL_SERVICE_ENTRIES.map(({ title, description }) => (
          <ClickableListItem
            key={`keyring-${title}`}
            title={title}
            description={description}
            onClick={openDrawer}
          />
        ))}
      </Grid>
      <StyledDrawer
        isOpen={isOpen}
        onClose={closeDrawer}
        big
        title={title}
        description={description}
      >
        <CalActionDrawer
          title={""}
          description={""}
          initialValues={{
            smartContractAddress: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
            calUrl: "https://crypto-assets-service.api.ledger-test.com",
            branch: "main",
          }}
        />
      </StyledDrawer>
    </PageWithHeader>
  );
};
