import React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DeviceActionIntermediateValue,
  DmkError,
  ExecuteDeviceActionReturnType,
} from "@ledgerhq/device-management-kit";
import { type DeviceModelId } from "@ledgerhq/device-management-kit";
import { Button, Divider } from "@ledgerhq/lumen-ui-react";
import { ArrowRight } from "@ledgerhq/lumen-ui-react/symbols";

import { BoxHeader } from "@/components/ApduView/BoxHeader";
import { Block } from "@/components/Block";
import { ClickableListItem } from "@/components/ClickableListItem";
import { Switch } from "@/components/fields";
import { Form, type LinkedFields, type ValueSelector } from "@/components/Form";
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
  InputValuesComponent?: React.FC<{
    initialValues: Input;
    onChange: (values: Input) => void;
    valueSelector?: ValueSelector<FieldType>;
    disabled?: boolean;
  }>;
  /** Optional custom component to render the successful output */
  OutputComponent?: React.FC<{
    output: Output;
    deviceModelId: DeviceModelId;
  }>;
  validateValues?: (args: Input) => boolean;
  valueSelector?: ValueSelector<FieldType>;
  labelSelector?: Partial<Record<string, string>>;
  linkedFields?: LinkedFields<Input & Record<string, FieldType>>;
  deviceModelId: DeviceModelId;
};

/**
 * For perf in fast flows, we only display the last 10 responses.
 * Impacts mainly app installs / Custom lock screen upload flows.
 */
const MAX_DISPLAYED_RESPONSES = 10;

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
    labelSelector,
    linkedFields,
    validateValues,
    InputValuesComponent,
    OutputComponent,
  } = props;

  const nonce = useRef(-1);

  const [values, setValues] = useState<Input>(initialValues);
  const [valuesInvalid, setValuesInvalid] = useState<boolean>(false);
  const [inspect, setInspect] = useState(false);

  const [responses, setResponses] = useState<
    DeviceActionResponseProps<Output, Error, IntermediateValue>[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [showAllResponses, setShowAllResponses] = useState(false);

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
    <div className="flex flex-col gap-y-8 overflow-scroll flex-1">
      <Block data-testid="form_device-action">
        <BoxHeader hint={hintInput}>Device Action input</BoxHeader>
        <div
          className="flex flex-col gap-y-8"
          style={{ opacity: loading ? 0.5 : 1 }}
        >
          {InputValuesComponent ? (
            <InputValuesComponent
              initialValues={values}
              onChange={setValues}
              valueSelector={valueSelector}
              disabled={loading}
            />
          ) : (
            <Form
              initialValues={values}
              onChange={setValues}
              valueSelector={valueSelector}
              labelSelector={labelSelector}
              linkedFields={linkedFields}
              disabled={loading}
            />
          )}
          <Divider />
          <Switch
            checked={inspect}
            disabled={loading}
            onChange={() => setInspect((d) => !d)}
            label="Inspect (dev tools)"
            name="Inspect"
          />
        </div>
      </Block>
      <div
        className="flex flex-row gap-x-8 overflow-hidden flex-1"
        style={{ minHeight: 250 }}
      >
        <Block className="w-[270px] overflow-hidden">
          <BoxHeader hint={hintUIExample}>Device Action UI example</BoxHeader>
          <div className="flex flex-1 flex-col justify-center items-center">
            <DeviceActionUI
              deviceModelId={deviceModelId}
              lastResponse={lastResponse}
            />
          </div>
          <div className="flex flex-row gap-x-8">
            <Button
              style={{ flex: 1 }}
              appearance="base"
              onClick={handleClickExecute}
              disabled={loading || valuesInvalid}
              icon={ArrowRight}
              loading={loading}
              data-testid="CTA_send-device-action"
            >
              Execute
            </Button>
            <Button
              appearance="gray"
              onClick={handleClickCancel}
              disabled={!loading}
            >
              Cancel
            </Button>
          </div>
        </Block>
        <Block className="flex-1 overflow-hidden">
          <BoxHeader hint={hintLogs}>Device Action logs</BoxHeader>
          <div
            className="flex flex-col gap-y-12 overflow-y-scroll flex-1 h-full"
            ref={responseBoxRef}
            data-testid="box_device-commands-responses"
          >
            {/* only show the last MAX_DISPLAYED_RESPONSES responses unless "showAllResponses" is true */}
            {responses.length > MAX_DISPLAYED_RESPONSES && (
              <Button
                appearance="gray"
                size="sm"
                onClick={() => setShowAllResponses((prev) => !prev)}
                className="shrink-0"
              >
                {showAllResponses
                  ? `Show last ${MAX_DISPLAYED_RESPONSES}`
                  : `Show all (${responses.length})`}
              </Button>
            )}
            {(showAllResponses
              ? responses
              : responses.slice(-MAX_DISPLAYED_RESPONSES)
            ).map((response, index, arr) => {
              const isLatest = index === arr.length - 1;
              return (
                <div
                  className="flex flex-col"
                  key={`${response.date.toISOString()}-index-${index}`}
                >
                  <DeviceActionResponse
                    {...response}
                    isLatest={isLatest}
                    OutputComponent={OutputComponent}
                    deviceModelId={deviceModelId}
                  />
                  <div hidden={isLatest}>
                    {/** if I just unmount it, all dividers are glitching out */}
                    <Divider className="my-8" />
                  </div>
                </div>
              );
            })}
          </div>
          <Button
            appearance="gray"
            isFull
            onClick={handleClickClear}
            disabled={responses.length === 0}
          >
            Clear responses
          </Button>
        </Block>
      </div>
    </div>
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
