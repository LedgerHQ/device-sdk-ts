import React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DeviceActionIntermediateValue,
  DmkError,
  ExecuteDeviceActionReturnType,
} from "@ledgerhq/device-management-kit";
import { type DeviceModelId } from "@ledgerhq/device-management-kit";
import {
  Button,
  Divider,
  Flex,
  Icons,
  InfiniteLoader,
  Switch,
  Text,
  Tooltip,
} from "@ledgerhq/react-ui";
import styled from "styled-components";

import { Block } from "@/components/Block";
import { ClickableListItem } from "@/components/ClickableListItem";
import {
  CommandForm,
  type ValueSelector,
} from "@/components/CommandsView/CommandForm";
import { type FieldType } from "@/hooks/useForm";

import {
  DeviceActionResponse,
  type DeviceActionResponseProps,
} from "./DeviceActionResponse";
import { DeviceActionUI } from "./DeviceActionUI";

export type DeviceActionProps<
  Output,
  Input extends Record<string, FieldType> | void,
  Error extends DmkError,
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
  deviceModelId: DeviceModelId;
};

const BoxTitle = styled(Text).attrs({
  variant: "h5Inter",
  color: "neutral.c70",
  mr: 2,
})``;

const BoxHeader: React.FC<{ children: string; hint: string }> = ({
  children,
  hint,
}) => {
  return (
    <Tooltip content={<Text color="neutral.c00">{hint}</Text>}>
      <Flex
        alignSelf="flex-start"
        flexDirection="row"
        alignItems="center"
        flexGrow={0}
      >
        <BoxTitle>{children}</BoxTitle>
        <Icons.Information size="XS" color="neutral.c70" />
      </Flex>
    </Tooltip>
  );
};

/**
 * Component to display an UI where a device action can be executed.
 * This UI is divided in three parts:
 * - Device Action input: where the user can input the arguments for the device action
 * - Device Action logs: where the user can see the logs of the device action (the values emitted by the device action)
 * - Device Action UI example: where the user can see an example of the device action UI
 */
export function DeviceActionTester<
  Output,
  Input extends Record<string, FieldType>,
  Error extends DmkError,
  IntermediateValue extends DeviceActionIntermediateValue,
>(props: DeviceActionProps<Output, Input, Error, IntermediateValue>) {
  const {
    deviceModelId,
    initialValues,
    executeDeviceAction,
    valueSelector,
    validateValues,
  } = props;

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

  const lastResponse = responses[responses.length - 1];

  const hintInput =
    "This is a form to input the arguments of the device action.";

  const hintLogs =
    "These are the values emitted by the observable returned when executing a device action.";

  const hintUIExample =
    "This is an example of what should be shown to the user while executing a device action.";

  return (
    <Flex flexDirection="column" rowGap={3} overflow="hidden" flex={1}>
      <Block data-testid="form_device-action">
        <BoxHeader hint={hintInput}>Device Action input</BoxHeader>
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
      </Block>
      <Flex flexDirection="row" columnGap={3} overflow="hidden" flex={1}>
        <Block width={270} flexDirection="column" overflow="hidden">
          <BoxHeader hint={hintUIExample}>Device Action UI example</BoxHeader>
          <Flex
            flex={1}
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
          >
            <DeviceActionUI
              deviceModelId={deviceModelId}
              lastResponse={lastResponse}
            />
          </Flex>
          <Flex flexDirection="row" columnGap={3}>
            <Button
              style={{ flex: 1 }}
              variant="main"
              onClick={handleClickExecute}
              disabled={loading || valuesInvalid}
              Icon={() =>
                loading ? <InfiniteLoader size={20} /> : <Icons.ArrowRight />
              }
              data-testid="CTA_send-device-action"
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
        <Block overflow="hidden" flex={1}>
          <BoxHeader hint={hintLogs}>Device Action logs</BoxHeader>
          <Flex
            ref={responseBoxRef}
            flexDirection="column"
            rowGap={4}
            overflowY="scroll"
            height="100%"
            flex={1}
            data-testid="box_device-commands-responses"
          >
            {responses.map((response, index, arr) => {
              const isLatest = index === arr.length - 1;
              return (
                <Flex
                  flexDirection="column"
                  key={`${response.date.toISOString()}-index-${index}`}
                >
                  <DeviceActionResponse {...response} isLatest={isLatest} />
                  <div hidden={isLatest}>
                    {/** if I just unmount it, all dividers are glitching out */}
                    <Divider my={2} />
                  </div>
                </Flex>
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
      </Flex>
    </Flex>
  );
}

export function DeviceActionRow<
  Output,
  Input extends Record<string, FieldType>,
  Error extends DmkError,
  IntermediateValue extends DeviceActionIntermediateValue,
>(
  props: DeviceActionProps<Output, Input, Error, IntermediateValue> & {
    onClick: () => void;
  },
) {
  const { title, description, onClick } = props;

  return (
    <>
      <ClickableListItem
        title={title}
        description={description}
        onClick={onClick}
      />
    </>
  );
}
