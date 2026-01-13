import React, { useEffect, useState } from "react";
import { ScrollView, TextInput } from "react-native";
import { useDevToolsConnector } from "_providers/devToolsConnectorProvider";
import { type Connector } from "@ledgerhq/device-management-kit-devtools-core";
import type { Message } from "@ledgerhq/device-management-kit-devtools-rozenite/src/shared/PluginEvents";
import { Button, Flex, Text } from "@ledgerhq/native-ui";

export function DevToolsTestScreen() {
  const connector = useDevToolsConnector();
  if (!connector) {
    return <Text>Connector loading...</Text>;
  }
  return (
    <Flex flex={1}>
      <Text>DevToolsTestScreen</Text>
      <Dashboard connector={connector} />
    </Flex>
  );
}

const Dashboard: React.FC<{ connector: Connector }> = ({ connector }) => {
  const [receivedMessages, setReceivedMessages] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);

  useEffect(() => {
    const subscription = connector.listenToMessages((type, payload) => {
      setReceivedMessages(prev => [...prev, { type, payload }]);
      console.log(type, payload);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [connector]);

  const sendMessage = (type: string, payload: string) => {
    connector.sendMessage(type, payload);
    setSentMessages(prev => [...prev, { type, payload }]);
  };

  return (
    <Flex flex={1} padding="16px">
      <Flex flexDirection="row" flex={1}>
        {/* Left Pane: Sent Messages */}
        <Flex flex={1} marginRight="8px">
          <Flex marginBottom="16px">
            <Text variant="h2">Sent Messages</Text>
          </Flex>
          <MessageSender onSend={sendMessage} />
          <ScrollView style={{ flex: 1, marginTop: 16 }}>
            {sentMessages.map((msg, idx) => (
              <Flex
                key={idx}
                marginBottom="8px"
                padding="8px"
                backgroundColor="neutral.c30"
                borderRadius="4px">
                <Text variant="body" fontWeight="bold">
                  {msg.type}:
                </Text>
                <Text variant="body">{msg.payload}</Text>
              </Flex>
            ))}
          </ScrollView>
        </Flex>

        {/* Right Pane: Received Messages */}
        <Flex flex={1} marginLeft="8px">
          <Flex marginBottom="16px">
            <Text variant="h2">Received Messages</Text>
          </Flex>
          <ScrollView style={{ flex: 1 }}>
            {receivedMessages.map((msg, idx) => (
              <Flex
                key={idx}
                marginBottom="8px"
                padding="8px"
                backgroundColor="neutral.c20"
                borderRadius="4px">
                <Text variant="body" fontWeight="bold">
                  {msg.type}:
                </Text>
                <Text variant="body">{msg.payload}</Text>
              </Flex>
            ))}
          </ScrollView>
        </Flex>
      </Flex>
    </Flex>
  );
};

interface MessageSenderProps {
  onSend: (type: string, payload: string) => void;
}

const MessageSender: React.FC<MessageSenderProps> = ({ onSend }) => {
  const [type, setType] = useState("");
  const [payload, setPayload] = useState("");

  return (
    <Flex flexDirection="column" gap="8px">
      <TextInput
        value={type}
        placeholder="Type"
        onChangeText={setType}
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          padding: 8,
          borderRadius: 4,
        }}
      />
      <TextInput
        value={payload}
        placeholder="Payload"
        onChangeText={setPayload}
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          padding: 8,
          borderRadius: 4,
        }}
      />
      <Button
        onPress={() => {
          if (type && payload) {
            onSend(type, payload);
            setType("");
            setPayload("");
          }
        }}>
        Send Message
      </Button>
    </Flex>
  );
};
