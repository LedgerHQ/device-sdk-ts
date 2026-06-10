import React, { useState } from "react";
import { type Mock } from "@ledgerhq/device-mockserver-client";
import { Button, Flex, Icons, Input, Text } from "@ledgerhq/react-ui";
import styled from "styled-components";

type MockItemProps = {
  mock: Mock;
  editable: boolean;
  onEdit: () => void;
  onSubmit: (prefix: string, response: string) => void;
  onDelete: () => void;
};

const inputContainerProps = { style: { borderRadius: 8 } };

const MockCard = styled(Flex)`
  flex-direction: row;
  align-items: center;
  column-gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.neutral.c30};
  background-color: ${({ theme }) => theme.colors.neutral.c20};
`;

const Mono = styled(Text).attrs({ variant: "body" })`
  font-family: "PassGeist Mono", monospace;
  word-break: break-all;
`;

export const MockItem: React.FC<MockItemProps> = ({
  mock,
  editable,
  onEdit,
  onSubmit,
  onDelete,
}) => {
  const [currentResponse, setCurrentResponse] = useState(
    mock.responses.join(", "),
  );
  const [currentPrefix, setCurrentPrefix] = useState(mock.prefix);

  return (
    <MockCard>
      {editable ? (
        <>
          <Flex flex={2}>
            <Input
              name="Mock prefix"
              containerProps={inputContainerProps}
              value={currentPrefix}
              onChange={setCurrentPrefix}
            />
          </Flex>
          <Flex flex={4}>
            <Input
              name="Mock response"
              containerProps={inputContainerProps}
              value={currentResponse}
              onChange={setCurrentResponse}
            />
          </Flex>
        </>
      ) : (
        <>
          <Mono style={{ flex: 2 }}>{mock.prefix}</Mono>
          <Mono style={{ flex: 4 }} color="neutral.c80">
            {mock.responses.join(", ")}
          </Mono>
        </>
      )}
      <Flex flexDirection="row" columnGap={2} style={{ width: 96 }}>
        <Button
          variant="shade"
          outline
          iconButton
          Icon={() => (editable ? <Icons.Check /> : <Icons.PenEdit />)}
          onClick={
            editable ? () => onSubmit(currentPrefix, currentResponse) : onEdit
          }
        />
        <Button
          variant="shade"
          outline
          iconButton
          Icon={() => <Icons.Trash />}
          onClick={onDelete}
        />
      </Flex>
    </MockCard>
  );
};
