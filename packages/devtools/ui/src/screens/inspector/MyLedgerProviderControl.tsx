import React, { useEffect, useState } from "react";
import { IconButton, TextInput } from "@ledgerhq/lumen-ui-react";
import { Refresh } from "@ledgerhq/lumen-ui-react/symbols";

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
    <div className="flex items-center gap-8">
      <TextInput
        className="w-256"
        label="My Ledger API provider"
        type="number"
        min="0"
        value={inputValue}
        onChange={handleChange}
        onBlur={() => setIsEditing(false)}
        hideClearButton
      />
      <IconButton
        aria-label="Refresh provider"
        title="Refresh provider"
        icon={Refresh}
        size="sm"
        appearance="gray"
        onClick={handleRefresh}
      />
    </div>
  );
};
