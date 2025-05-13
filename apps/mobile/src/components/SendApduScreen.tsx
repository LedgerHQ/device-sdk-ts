import React from "react";
import { useDeviceSessionsContext } from "_providers/deviceSessionsProvider.tsx";
import { useDmk } from "_providers/dmkProvider.tsx";
import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import { AnimatedInput, Box, Button, Flex, Text } from "@ledgerhq/native-ui";
import styled from "styled-components/native";

const Container = styled(Flex)`
  background-color: ${({ theme }) => theme.colors.background.main};
  flex: 1;
  padding: 16px;
  justify-content: space-between;
`;

export const SendApduScreen = () => {
  const [apdu, setApdu] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [response, setResponse] = React.useState<string>("");
  const dmk = useDmk();
  const {
    state: { selectedId: deviceSessionId },
  } = useDeviceSessionsContext();

  const onSubmit = async () => {
    const buffer = hexaStringToBuffer(apdu);
    if (buffer && deviceSessionId) {
      setResponse("");
      setLoading(true);
      await dmk.sendApdu({
        apdu: buffer,
        sessionId: deviceSessionId,
      });
      setLoading(false);
    }
  };
  return (
    <Container>
      <Flex>
        <Text>Send APDU</Text>
        <AnimatedInput
          multiline
          numberOfLines={10}
          value={apdu}
          onChangeText={setApdu}
        />
        <Box backgroundColor="primary.c10" width="100%" height="50%">
          {loading ? <Text>Loading...</Text> : <Text>{response}</Text>}
        </Box>
      </Flex>
      <Button onPress={onSubmit}>Send</Button>
    </Container>
  );
};
