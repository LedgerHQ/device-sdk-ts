import React, { useEffect, useState } from "react";
import styled from "styled-components";

const Container = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 16px;
`;

const Label = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: #333;
`;

const Value = styled.span`
  font-size: 14px;
  font-family: monospace;
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #ddd;
`;

const Input = styled.input`
  width: 80px;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-family: monospace;

  &:focus {
    outline: none;
    border-color: #2196f3;
  }
`;

const Button = styled.button`
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #f0f0f0;
    border-color: #bbb;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SetButton = styled(Button)`
  background: #4caf50;
  color: white;
  border-color: #4caf50;

  &:hover:not(:disabled) {
    background: #43a047;
  }
`;

type ProviderControlProps = {
  currentValue: number | null;
  onGet: () => void;
  onSet: (value: number) => void;
};

export const ProviderControl: React.FC<ProviderControlProps> = ({
  currentValue,
  onGet,
  onSet,
}) => {
  const [inputValue, setInputValue] = useState("");

  // Fetch provider value on mount
  useEffect(() => {
    onGet();
  }, [onGet]);

  const handleSet = () => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed)) {
      onSet(parsed);
      setInputValue("");
    }
  };

  return (
    <Container>
      <Label>Provider:</Label>
      <Value>{currentValue !== null ? currentValue : "—"}</Value>
      <Button onClick={onGet}>Refresh</Button>
      <Input
        type="number"
        placeholder="New value"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSet()}
      />
      <SetButton onClick={handleSet} disabled={!inputValue}>
        Set
      </SetButton>
    </Container>
  );
};
