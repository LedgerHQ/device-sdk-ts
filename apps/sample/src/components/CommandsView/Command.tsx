import React, { useCallback, useEffect, useState } from "react";

import {
  Flex,
  Text,
  Icons,
  Drawer,
  Button,
  InfiniteLoader,
} from "@ledgerhq/react-ui";
import styled from "styled-components";
import { CommandForm, ValueSelector } from "./CommandForm";
import { FieldType } from "@/hooks/useForm";
import { CommandResponse, CommandResponseProps } from "./CommandResponse";

const Wrapper = styled(Flex)`
  opacity: 0.8;

  &:hover {
    opacity: 1;
  }

  cursor: pointer;
`;

const Container = styled(Flex).attrs({
  flexDirection: "column",
  backgroundColor: "opacityDefault.c05",
  p: 5,
  borderRadius: 2,
  rowGap: 4,
})``;

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

  const [isOpen, setIsOpen] = React.useState(false);

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
    <Wrapper
      flexDirection="row"
      alignItems="center"
      p={6}
      backgroundColor={"opacityDefault.c05"}
      borderRadius={2}
      onClick={openDrawer}
    >
      <Flex flex={1} flexDirection="column" rowGap={4}>
        <Text variant="large" fontWeight="semiBold">
          {title}
        </Text>
        <Text variant="body" fontWeight="regular" color="opacityDefault.c60">
          {description}
        </Text>
      </Flex>
      <Icons.ChevronRight size="M" color="opacityDefault.c50" />
      <Drawer isOpen={isOpen} onClose={closeDrawer} big title={title}>
        <Flex flexDirection="column" rowGap={4} flex={1} overflowY="hidden">
          <Text
            variant="body"
            fontWeight="regular"
            color="opacityDefault.c60"
            mb={5}
          >
            {description}
          </Text>
          <Container>
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
          </Container>
          <Container flex={1} overflowY="hidden">
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
          </Container>
        </Flex>
      </Drawer>
    </Wrapper>
  );
}

export default Command;
