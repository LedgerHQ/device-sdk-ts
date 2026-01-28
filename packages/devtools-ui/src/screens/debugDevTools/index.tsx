/**
 * @file DebugDevTools screen
 *
 * A debugging tool for DevTools developers. Displays raw sent and received
 * connector messages, allows filtering by message type, and provides a way
 * to manually send custom messages for testing.
 */

import React, { useMemo, useState } from "react";

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
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Left Pane: Sent Messages */}
      <div
        style={{
          flex: 1,
          borderRight: "1px solid #ddd",
          padding: "16px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h2>sent messages</h2>
        <MessageSender onSend={sendMessage} />
        <MessageTypeFilter
          types={sentMessageTypes}
          value={sentFilter}
          onChange={setSentFilter}
          style={{ marginTop: 16 }}
        />
        <div style={{ marginTop: 16, flex: 1, overflowY: "auto" }}>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {filteredSentMessages.map((msg, idx) => (
              <li key={idx} style={{ marginBottom: 4 }}>
                <strong>{msg.type}:</strong> {msg.payload}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {/* Right Pane: Received Messages */}
      <div
        style={{
          flex: 1,
          padding: "16px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h2>received messages</h2>
        <MessageTypeFilter
          types={receivedMessageTypes}
          value={receivedFilter}
          onChange={setReceivedFilter}
        />
        <div style={{ marginTop: 16, flex: 1, overflowY: "auto" }}>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {filteredReceivedMessages.map((msg, idx) => (
              <li key={idx} style={{ marginBottom: 4 }}>
                <strong>{msg.type}:</strong> {msg.payload}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

interface MessageTypeFilterProps {
  types: string[];
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
}

const MessageTypeFilter: React.FC<MessageTypeFilterProps> = ({
  types,
  value,
  onChange,
  style,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, ...style }}>
    <label>Filter by type:</label>
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All ({types.length} types)</option>
      {types.map((type) => (
        <option key={type} value={type}>
          {type}
        </option>
      ))}
    </select>
    {value && (
      <button onClick={() => onChange("")} style={{ padding: "2px 8px" }}>
        Clear
      </button>
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
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <input
        type="text"
        value={type}
        placeholder="type"
        onChange={(e) => setType(e.target.value)}
        style={{ flex: 1 }}
      />
      <input
        type="text"
        value={payload}
        placeholder="payload"
        onChange={(e) => setPayload(e.target.value)}
        style={{ flex: 2 }}
      />
      <button
        onClick={() => {
          if (type && payload) {
            onSend(type, payload);
            setType("");
            setPayload("");
          }
        }}
      >
        sendMessage
      </button>
    </div>
  );
};
