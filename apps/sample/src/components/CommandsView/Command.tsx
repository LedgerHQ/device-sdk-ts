import React, { useCallback, useEffect, useState } from "react";
import {
  type CommandResult,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Button } from "@ledgerhq/lumen-ui-react";
import { ArrowRight } from "@ledgerhq/lumen-ui-react/symbols";

import { Block } from "@/components/Block";
import { ClickableListItem } from "@/components/ClickableListItem";
import { Form, type ValueSelector } from "@/components/Form";
import { StyledDrawer } from "@/components/StyledDrawer";
import { type FieldType } from "@/hooks/useForm";

import { CommandResponse, type CommandResponseProps } from "./CommandResponse";

export type CommandProps<
  CommandArgs extends Record<string, FieldType> | void,
  Response,
  ErrorCodes = void,
> = {
  title: string;
  description: string;
  sendCommand: (
    args: CommandArgs,
  ) => Promise<CommandResult<Response, ErrorCodes>>;
  initialValues: CommandArgs;
  valueSelector?: ValueSelector<FieldType>;
};

export function Command<
  CommandArgs extends Record<string, FieldType>,
  Response,
  ErrorCodes,
>(props: CommandProps<CommandArgs, Response, ErrorCodes>) {
  const { title, description, initialValues, sendCommand, valueSelector } =
    props;

  const [values, setValues] = useState<CommandArgs>(initialValues);

  const [isOpen, setIsOpen] = useState(false);

  const [responses, setResponses] = useState<
    CommandResponseProps<Response, ErrorCodes>[]
  >([]);

  const [loading, setLoading] = useState(false);

  const openDrawer = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleClickSend = useCallback(() => {
    setLoading(true);
    setResponses((prev) => [
      ...prev,
      { args: values, date: new Date(), response: null, loading: true },
    ]);
    sendCommand(values)
      .then((response) => {
        setResponses((prev) => {
          if (!isSuccessCommandResult(response)) {
            return [
              ...prev.slice(0, -1),
              {
                args: values,
                date: new Date(),
                response: response,
                loading: false,
              },
            ];
          }
          return [
            ...prev.slice(0, -1),
            { args: values, date: new Date(), response, loading: false },
          ];
        });
      })
      .catch((error) => {
        setLoading(false);
        setResponses((prev) => [
          ...prev.slice(0, -1),
          { args: values, date: new Date(), loading: false, response: error },
        ]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [values, sendCommand]);

  const handleClickClear = useCallback(() => {
    setResponses([]);
  }, []);

  const responseBoxRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // scroll response box to bottom
    if (responseBoxRef.current) {
      responseBoxRef.current.scrollTop = responseBoxRef.current.scrollHeight;
    }
  }, [responses]);

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
        <Block data-testid="form_device-command">
          <Form
            initialValues={values}
            onChange={setValues}
            valueSelector={valueSelector}
          />
          <Button
            appearance="base"
            isFull
            onClick={handleClickSend}
            disabled={loading}
            icon={ArrowRight}
            loading={loading}
            data-testid="CTA_send-device-command"
          >
            Send
          </Button>
        </Block>
        <Block className="flex-1 overflow-y-hidden">
          <div
            className="flex flex-col gap-y-12 flex-1 overflow-y-scroll"
            ref={responseBoxRef}
            data-testid="box_device-commands-responses"
          >
            {responses.map(({ args, date, response, loading: l }, index) => (
              <CommandResponse
                args={args}
                key={date.toISOString()}
                date={date}
                response={response}
                loading={l}
                isLatest={index === responses.length - 1}
              />
            ))}
          </div>
          <Button
            appearance="gray"
            onClick={handleClickClear}
            disabled={responses.length === 0}
          >
            Clear responses
          </Button>
        </Block>
      </StyledDrawer>
    </>
  );
}
