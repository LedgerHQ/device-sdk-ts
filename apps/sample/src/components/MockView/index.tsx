import React, { useEffect, useState } from "react";
import { Mock } from "@ledgerhq/device-sdk-transport-mock/src/model/Mock";
import { Session } from "@ledgerhq/device-sdk-transport-mock/src/model/Session";
import { Button, Divider, Flex, Input, Link, Text } from "@ledgerhq/react-ui";
import styled, { DefaultTheme } from "styled-components";

import { useMockClient } from "@/providers/MockClientProvider";

const Root = styled(Flex).attrs({ mx: 15, mt: 10, mb: 5 })`
  flex-direction: column;
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const Title = styled(Text).attrs({
  variant: "large",
  fontSize: 18,
  mt: 8,
})``;

const FormContainer = styled(Flex)`
  background-color: ${({ theme }: { theme: DefaultTheme }) =>
    theme.colors.neutral.c30};
  height: 100%;
  width: 100%;
  flex-direction: column;
  border-radius: 12px;
`;

const Header = styled(Flex).attrs({ px: 8, py: 6 })``;

const Form = styled(Flex).attrs({ my: 6, px: 10 })`
  flex: 1;
  flex-direction: row;
  justify-content: center;
  gap: 70px;
`;

const SessionsContainer = styled(Flex)`
  height: 100%;
  flex-direction: column;
  gap: 10px;
`;

const SessionEntry = styled(Link).attrs({
  variant: "paragraph",
  fontWeight: "semiBold",
  ml: 5,
})``;

const MocksContainer = styled(Flex)`
  height: 100%;
  width: 70%;
  flex-direction: column;
  gap: 10px;
`;

const MockEntry = styled(Flex)`
  width: 100%;
  flex-direction: row;
`;

const MockButton = styled(Button).attrs({
  variant: "main",
  size: "small",
  color: "neutral.c00",
})``;

export const MockView: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mocks, setMocks] = useState<Mock[]>([]);

  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [currentPrefix, setCurrentPrefix] = useState<string>("e001");
  const [currentResponse, setCurrentResponse] = useState<string>("123456789");

  const client = useMockClient();

  const fetchSessions = async () => {
    try {
      const response = await client.getConnected();
      setSessions(response);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchMocks = async (session: Session) => {
    try {
      const response = await client.getMocks(session.id);
      setMocks(response);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSessionClick = async (session: Session) => {
    try {
      setCurrentSession(session);
      fetchMocks(session).catch(console.error);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddMockClick = async () => {
    if (!currentSession) {
      return;
    }
    try {
      const response = await client.addMock(currentSession.id, currentPrefix, currentResponse);
      if (!response) {
        console.log("Failed to add the mock");
      } else {
        fetchMocks(currentSession).catch(console.error);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleRemoveMocksClick = async () => {
    if (!currentSession) {
      return;
    }
    try {
      const response = await client.deleteMocks(currentSession.id);
      if (!response) {
        console.log("Failed to delete the mocks");
      } else {
        fetchMocks(currentSession).catch(console.error);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => { fetchSessions().catch(console.error); }, []);

  const inputContainerProps = { style: { borderRadius: 4 } };

  return (
    <Root>
      <FormContainer>
        <Header>
          <Title>Mock Server</Title>
        </Header>
        <Divider my={4} />
        <Form>
          <SessionsContainer>
            <Header>
              <Title>Devices:</Title>
            </Header>
            <Divider my={4} />
            {sessions.map((session, index) => (
              <SessionEntry key={index} onClick={() => handleSessionClick(session)}>
                {session.device.name}
              </SessionEntry>
            ))}
          </SessionsContainer>
          <MocksContainer>
            <Header>
              <Title>Installed mocks:</Title>
            </Header>
            <Divider my={4} />
            {mocks.map((mock, index) => (
              <MockEntry key={index}>
                <Text variant="body">{mock.prefix} = {mock.response}</Text>
              </MockEntry>
            ))}
            {currentSession && <Divider my={4} />}
            {currentSession && <MockEntry>
              <Input
                name="APDU Prefix"
                containerProps={inputContainerProps}
                value={currentPrefix}
                onChange={(value) => setCurrentPrefix(value)}
              />
              <Input
                name="Mock response"
                containerProps={inputContainerProps}
                value={currentResponse}
                onChange={(value) => setCurrentResponse(value)}
              />
              <MockButton onClick={() => handleAddMockClick()}>
                <Text color="neutral.c00">Add</Text>
              </MockButton>
            </MockEntry>}
            {currentSession && <MockEntry>
              <MockButton onClick={() => handleRemoveMocksClick()}>
                <Text color="neutral.c00">Remove all mocks</Text>
              </MockButton>
            </MockEntry>}
          </MocksContainer>
        </Form>
      </FormContainer>
    </Root>
  );
};
