/**
 * @file DebugDevTools screen
 *
 * A debugging tool for DevTools developers. Displays raw sent and received
 * connector messages, allows filtering by message type, and provides a way
 * to manually send custom messages for testing.
 */

import React, { useMemo, useState } from "react";
import { Button, TextInput } from "@ledgerhq/lumen-ui-react";

import { type Message } from "../../shared/PluginEvents";

interface DebugDevToolsMessageProps {
  sentMessages: Message[];
  receivedMessages: Message[];
  sendMessage: (type: string, payload: string) => void;
}

export const DebugDevTools: React.FC<DebugDevToolsMessageProps> = ({
  sentMessages,
  receivedMessages,
  sendMessage,
}) => {
  const [sentFilter, setSentFilter] = useState("");
  const [receivedFilter, setReceivedFilter] = useState("");

  const sentMessageTypes = useMemo(
    () => [...new Set(sentMessages.map((m) => m.type))],
    [sentMessages],
  );
  const receivedMessageTypes = useMemo(
    () => [...new Set(receivedMessages.map((m) => m.type))],
    [receivedMessages],
  );

  const filteredSentMessages = useMemo(
    () =>
      sentFilter
        ? sentMessages.filter((m) => m.type === sentFilter)
        : sentMessages,
    [sentMessages, sentFilter],
  );

  const filteredReceivedMessages = useMemo(
    () =>
      receivedFilter
        ? receivedMessages.filter((m) => m.type === receivedFilter)
        : receivedMessages,
    [receivedMessages, receivedFilter],
  );

  return (
    <div className="flex h-full">
      {/* Left Pane: Sent Messages */}
      <div className="flex flex-1 flex-col gap-12 border-r border-muted-subtle p-16">
        <h2 className="body-1-semi-bold">Sent messages</h2>
        <MessageSender onSend={sendMessage} />
        <MessageTypeFilter
          types={sentMessageTypes}
          value={sentFilter}
          onChange={setSentFilter}
        />
        <MessageList messages={filteredSentMessages} />
      </div>
      {/* Right Pane: Received Messages */}
      <div className="flex flex-1 flex-col gap-12 p-16">
        <h2 className="body-1-semi-bold">Received messages</h2>
        <MessageTypeFilter
          types={receivedMessageTypes}
          value={receivedFilter}
          onChange={setReceivedFilter}
        />
        <MessageList messages={filteredReceivedMessages} />
      </div>
    </div>
  );
};

const MessageList: React.FC<{ messages: Message[] }> = ({ messages }) => (
  <ul className="min-h-0 flex-1 overflow-y-auto font-mono! body-3">
    {messages.map((msg, idx) => (
      <li key={idx} className="mb-4 break-all">
        <strong className="text-interactive">{msg.type}:</strong> {msg.payload}
      </li>
    ))}
  </ul>
);

interface MessageTypeFilterProps {
  types: string[];
  value: string;
  onChange: (value: string) => void;
}

const MessageTypeFilter: React.FC<MessageTypeFilterProps> = ({
  types,
  value,
  onChange,
}) => (
  <div className="flex items-center gap-8 body-3">
    <label className="text-muted">Filter by type:</label>
    <select
      className="h-32 rounded-sm bg-muted px-8 body-3 text-base outline-none focus:ring-2 focus:ring-active"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">All ({types.length} types)</option>
      {types.map((type) => (
        <option key={type} value={type}>
          {type}
        </option>
      ))}
    </select>
    {value && (
      <Button appearance="no-background" size="sm" onClick={() => onChange("")}>
        Clear
      </Button>
    )}
  </div>
);

interface MessageSenderProps {
  onSend: (type: string, payload: string) => void;
}

const MessageSender: React.FC<MessageSenderProps> = ({ onSend }) => {
  const [type, setType] = useState("");
  const [payload, setPayload] = useState("");

  return (
    <div className="flex items-center gap-8">
      <TextInput
        className="flex-1"
        value={type}
        placeholder="type"
        onChange={(e) => setType(e.target.value)}
      />
      <TextInput
        className="flex-2"
        value={payload}
        placeholder="payload"
        onChange={(e) => setPayload(e.target.value)}
      />
      <Button
        appearance="base"
        size="lg"
        disabled={!type || !payload}
        onClick={() => {
          onSend(type, payload);
          setType("");
          setPayload("");
        }}
      >
        Send
      </Button>
    </div>
  );
};
