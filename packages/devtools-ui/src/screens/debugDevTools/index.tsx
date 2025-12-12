import React, { useState } from "react";

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
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Left Pane: Sent Messages */}
      <div
        style={{
          flex: 1,
          borderRight: "1px solid #ddd",
          padding: "16px",
          boxSizing: "border-box",
        }}
      >
        <h2>sent messages</h2>
        <MessageSender onSend={sendMessage} />
        <div style={{ marginTop: "24px" }}>
          <ul style={{ overflowY: "scroll" }}>
            {sentMessages.map((msg, idx) => (
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
          overflowY: "scroll",
        }}
      >
        <h2>received messages</h2>
        <ul style={{ overflowY: "scroll" }}>
          {receivedMessages.map((msg, idx) => (
            <li key={idx} style={{ marginBottom: 4 }}>
              <strong>{msg.type}:</strong> {msg.payload}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

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
