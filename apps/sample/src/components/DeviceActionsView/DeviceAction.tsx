import {
  type SdkError,
  type ExecuteDeviceActionReturnType,
  type DeviceActionIntermediateValue,
} from "@ledgerhq/device-sdk-core";
import { CommandForm, ValueSelector } from "../CommandsView/CommandForm";
import { FieldType } from "@/hooks/useForm";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ClickableListItem } from "@/components/ClickableListItem";
import { StyledDrawer } from "@/components//StyledDrawer";
import { Block } from "@/components/Block";
import {
  Flex,
  Button,
  Icons,
  InfiniteLoader,
  Divider,
  Switch,
} from "@ledgerhq/react-ui";
import {
  DeviceActionResponseProps,
  DeviceActionResponse,
} from "./DeviceActionResponse";

export type DeviceActionProps<
  Output,
  Input extends Record<string, FieldType> | void,
  Error extends SdkError,
  IntermediateValue extends DeviceActionIntermediateValue,
> = {
  title: string;
  description: string;
  executeDeviceAction: (
    args: Input,
    debug?: boolean,
  ) => ExecuteDeviceActionReturnType<Output, Error, IntermediateValue>;
  initialValues: Input;
  validateValues?: (args: Input) => boolean;
  valueSelector?: ValueSelector<FieldType>;
};

export function DeviceActionDrawer<
  Output,
  Input extends Record<string, FieldType>,
  Error extends SdkError,
  IntermediateValue extends DeviceActionIntermediateValue,
>(props: DeviceActionProps<Output, Input, Error, IntermediateValue>) {
  const { initialValues, executeDeviceAction, valueSelector, validateValues } =
    props;

  const nonce = useRef(-1);

  const [values, setValues] = useState<Input>(initialValues);
  const [valuesInvalid, setValuesInvalid] = useState<boolean>(false);
  const [inspect, setInspect] = useState(false);

  const [responses, setResponses] = useState<
    DeviceActionResponseProps<Output, Error, IntermediateValue>[]
  >([]);

  const [loading, setLoading] = useState(false);

  const cancelDeviceActionRef = useRef(() => {});

  const handleClickExecute = useCallback(() => {
    setLoading(true);

    const id = ++nonce.current;

    const { cancel, observable } = executeDeviceAction(values, inspect);

    cancelDeviceActionRef.current = cancel;

    const handleDeviceActionDone = () => {
      setLoading(false);
      cancelDeviceActionRef.current = () => {};
    };

    observable.subscribe({
      next: (deviceActionState) => {
        setResponses((prev) => [
          ...prev,
          {
            args: values,
            date: new Date(),
            deviceActionState,
            loading: false,
            id,
          },
        ]);
      },
      error: (error) => {
        setResponses((prev) => [
          ...prev,
          {
            args: values,
            date: new Date(),
            error,
            loading: false,
            id,
          },
        ]);
        handleDeviceActionDone();
      },
      complete: () => {
        handleDeviceActionDone();
      },
    });
  }, [values, executeDeviceAction, inspect]);

  const handleClickClear = useCallback(() => {
    setResponses([]);
  }, []);

  const handleClickCancel = useCallback(() => {
    cancelDeviceActionRef.current();
  }, []);

  const responseBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // scroll response box to bottom
    if (responseBoxRef.current) {
      responseBoxRef.current.scrollTop = responseBoxRef.current.scrollHeight;
    }
  }, [responses]);

  useEffect(() => {
    return () => cancelDeviceActionRef.current();
  }, []);

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
          <Switch
            checked={inspect}
            disabled={loading}
            onChange={() => setInspect((d) => !d)}
            label="Inspect (dev tools)"
            name="Inspect"
          />
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
            Execute
          </Button>
          <Button
            variant="neutral"
            onClick={handleClickCancel}
            disabled={!loading}
          >
            Cancel
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
          {responses.map((response, index, arr) => {
            const isLatest = index === arr.length - 1;
            return (
              <React.Fragment key={response.date.toISOString()}>
                <DeviceActionResponse {...response} isLatest={isLatest} />
                <div hidden={isLatest}>
                  {/** if I just unmount it, all dividers are glitching out */}
                  <Divider my={2} />
                </div>
              </React.Fragment>
            );
          })}
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

export function DeviceAction<
  Output,
  Input extends Record<string, FieldType>,
  Error extends SdkError,
  IntermediateValue extends DeviceActionIntermediateValue,
>(props: DeviceActionProps<Output, Input, Error, IntermediateValue>) {
  const { title, description } = props;

  const [isOpen, setIsOpen] = useState(false);
  const openDrawer = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <>
      <ClickableListItem
        title={title}
        description={description}
        onClick={openDrawer}
      />
      <StyledDrawer
        isOpen={isOpen}
        onClose={closeDrawer}
        big
        title={title}
        description={description}
      >
        <DeviceActionDrawer {...props} />
      </StyledDrawer>
    </>
  );
}
