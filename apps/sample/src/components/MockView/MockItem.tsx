import React, { useState } from "react";
import { type Mock } from "@ledgerhq/device-mockserver-client";
import { Button, Flex, Icons, Input, Text } from "@ledgerhq/react-ui";

type MockItemProps = {
  mock: Mock;
  editable: boolean;
  onEdit: () => void;
  onSubmit: (prefix: string, response: string) => void;
  onDelete: () => void;
};

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
    <Flex
      flexDirection="row"
      flex={5}
      alignItems="center"
      justifyContent="space-between"
      my={7}
    >
      {editable ? (
        <>
          <Flex
            flex={2}
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
          >
            <Input
              style={{ width: "32px" }}
              name="Mock response"
              containerProps={{ style: { borderRadius: 4 } }}
              value={currentPrefix}
              onChange={setCurrentPrefix}
            />
          </Flex>
          <Flex
            flex={2}
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
          >
            <Input
              style={{ width: "32px" }}
              name="Mock response"
              containerProps={{ style: { borderRadius: 4 } }}
              value={currentResponse}
              onChange={setCurrentResponse}
            />
          </Flex>
        </>
      ) : (
        <>
          <Text variant="body" style={{ flex: 2 }} textAlign="center">
            {mock.prefix}
          </Text>
          <Text variant="body" style={{ flex: 2 }} textAlign="center">
            {mock.responses.join(", ")}
          </Text>
        </>
      )}
      <Flex flex={1} justifyContent="center" columnGap={2}>
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
    </Flex>
  );
};
