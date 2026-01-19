import React, { useState } from "react";
import styled from "styled-components";

import { type ApduResponse } from "../../hooks/useConnectorMessages";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eee;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
`;

const ToggleIcon = styled.span<{ $expanded: boolean }>`
  font-size: 12px;
  color: #666;
  transition: transform 0.15s ease;
  transform: rotate(${({ $expanded }) => ($expanded ? "90deg" : "0deg")});
`;

const Title = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: #666;
`;

const Content = styled.div<{ $expanded: boolean }>`
  display: ${({ $expanded }) => ($expanded ? "flex" : "none")};
  flex-direction: column;
  gap: 8px;
`;

const InputRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const Input = styled.input`
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;

  &:focus {
    outline: none;
    border-color: #2196f3;
  }

  &::placeholder {
    color: #999;
  }
`;

const Button = styled.button`
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: #2196f3;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: #1976d2;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ResponseContainer = styled.div<{ $success: boolean }>`
  padding: 8px;
  border-radius: 4px;
  background: ${({ $success }) => ($success ? "#e8f5e9" : "#ffebee")};
  border: 1px solid ${({ $success }) => ($success ? "#c8e6c9" : "#ffcdd2")};
  font-size: 12px;
  font-family: monospace;
`;

const ResponseLabel = styled.span`
  font-weight: 600;
  color: #333;
`;

const ResponseData = styled.span`
  color: #555;
  word-break: break-all;
`;

type ApduSenderProps = {
  sessionId: string;
  onSend: (sessionId: string, apduHex: string) => string;
  responses: Map<string, ApduResponse>;
};

export const ApduSender: React.FC<ApduSenderProps> = ({
  sessionId,
  onSend,
  responses,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [apduInput, setApduInput] = useState("");
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);

  const handleSend = () => {
    if (!apduInput.trim()) return;
    // Remove spaces and validate hex
    const cleanHex = apduInput.replace(/\s/g, "").toUpperCase();
    if (!/^[0-9A-F]*$/.test(cleanHex) || cleanHex.length % 2 !== 0) {
      alert(
        "Invalid hex string. Please enter a valid APDU in hex format (e.g., E0C4000000)",
      );
      return;
    }
    const requestId = onSend(sessionId, cleanHex);
    setLastRequestId(requestId);
  };

  const lastResponse = lastRequestId ? responses.get(lastRequestId) : null;

  const formatBytes = (bytes: number[] | undefined): string => {
    if (!bytes || !Array.isArray(bytes)) return "";
    return bytes
      .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
      .join(" ");
  };

  return (
    <Container>
      <Header onClick={() => setExpanded(!expanded)}>
        <ToggleIcon $expanded={expanded}>▶</ToggleIcon>
        <Title>Send APDU</Title>
      </Header>
      <Content $expanded={expanded}>
        <InputRow>
          <Input
            type="text"
            placeholder="APDU hex (e.g., E0C4000000)"
            value={apduInput}
            onChange={(e) => setApduInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <Button onClick={handleSend} disabled={!apduInput.trim()}>
            Send
          </Button>
        </InputRow>
        {lastResponse && (
          <ResponseContainer $success={lastResponse.success}>
            {lastResponse.success ? (
              <>
                <ResponseLabel>Status: </ResponseLabel>
                <ResponseData>
                  {formatBytes(lastResponse.statusCode)}
                </ResponseData>
                {lastResponse.data && lastResponse.data.length > 0 && (
                  <>
                    <br />
                    <ResponseLabel>Data: </ResponseLabel>
                    <ResponseData>
                      {formatBytes(lastResponse.data)}
                    </ResponseData>
                  </>
                )}
              </>
            ) : (
              <>
                <ResponseLabel>Error: </ResponseLabel>
                <ResponseData>{lastResponse.error}</ResponseData>
              </>
            )}
          </ResponseContainer>
        )}
      </Content>
    </Container>
  );
};
