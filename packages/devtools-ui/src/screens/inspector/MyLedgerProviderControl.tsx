import React, { useEffect, useState } from "react";
import styled from "styled-components";

const Container = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 16px;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: #333;
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

const RefreshButton = styled.button`
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #f0f0f0;
    border-color: #bbb;
  }
`;

type MyLedgerProviderControlProps = {
  currentValue: number | null;
  onGet: () => void;
  onSet: (value: number) => void;
};

export const MyLedgerProviderControl: React.FC<
  MyLedgerProviderControlProps
> = ({ currentValue, onGet, onSet }) => {
  const [inputValue, setInputValue] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  // Fetch provider value on mount
  useEffect(() => {
    onGet();
  }, [onGet]);

  // Sync input with current value when it changes from server (only if not actively editing)
  useEffect(() => {
    if (currentValue !== null && !isEditing) {
      setInputValue(String(currentValue));
    }
  }, [currentValue, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setIsEditing(true);

    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 0 && String(parsed) === value) {
      onSet(parsed);
    }
  };

  const handleRefresh = () => {
    setIsEditing(false);
    onGet();
    // Immediately sync to current value if available
    if (currentValue !== null) {
      setInputValue(String(currentValue));
    }
  };

  return (
    <Container>
      <Label htmlFor="provider-input">My Ledger API provider:</Label>
      <Input
        id="provider-input"
        type="number"
        min="0"
        value={inputValue}
        onChange={handleChange}
        onBlur={() => setIsEditing(false)}
      />
      <RefreshButton onClick={handleRefresh} title="Refresh">
        🔄
      </RefreshButton>
    </Container>
  );
};
