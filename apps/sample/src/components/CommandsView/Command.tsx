import React, { useCallback, useEffect, useState } from "react";

import { Flex, Icons, Button, InfiniteLoader } from "@ledgerhq/react-ui";
import { CommandForm, ValueSelector } from "./CommandForm";
import { FieldType } from "@/hooks/useForm";
import { CommandResponse, CommandResponseProps } from "./CommandResponse";
import { Block } from "../Block";
import { ClickableListItem } from "../ClickableListItem";
import { StyledDrawer } from "../StyledDrawer";

export type CommandProps<
  CommandArgs extends Record<string, FieldType> | void,
  Response,
> = {
  title: string;
  description: string;
  sendCommand: (args: CommandArgs) => Promise<Response>;
  initialValues: CommandArgs;
  valueSelector?: ValueSelector<FieldType>;
};

export function Command<
  CommandArgs extends Record<string, FieldType>,
  Response,
>(props: CommandProps<CommandArgs, Response>) {
  const { title, description, initialValues, sendCommand, valueSelector } =
    props;

  const [values, setValues] = useState<CommandArgs>(initialValues);

  const [isOpen, setIsOpen] = useState(false);

  const [responses, setResponses] = useState<CommandResponseProps<Response>[]>(
    [],
  );

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
        setResponses((prev) => [
          ...prev.slice(0, -1),
          { args: values, date: new Date(), response, loading: false },
        ]);
      })
      .catch((error) => {
        setResponses((prev) => [
          ...prev.slice(0, -1),
          { args: values, date: new Date(), response: error, loading: false },
        ]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [values]);

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
        <Block>
          <CommandForm
            initialValues={values}
            onChange={setValues}
            valueSelector={valueSelector}
          />
          <Button
            variant="main"
            onClick={handleClickSend}
            disabled={loading}
            Icon={() =>
              loading ? <InfiniteLoader size={20} /> : <Icons.ArrowRight />
            }
          >
            Send
          </Button>
        </Block>
        <Block flex={1} overflowY="hidden">
          <Flex
            ref={responseBoxRef}
            flexDirection="column"
            rowGap={4}
            flex={1}
            overflowY="scroll"
          >
            {responses.map(({ args, date, response, loading }, index) => (
              <CommandResponse
                args={args}
                key={date.toISOString()}
                date={date}
                response={response}
                loading={loading}
                isLatest={index === responses.length - 1}
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
      </StyledDrawer>
    </>
  );
}

export default Command;
