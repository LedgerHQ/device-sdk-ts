import React from "react";
import {
  AddressInput,
  TextInput,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@ledgerhq/lumen-ui-react";
import { InformationFill } from "@ledgerhq/lumen-ui-react/symbols";

import {
  type AddressCheck,
  CONTACT_ADDRESS_LABEL_MAX_LENGTH,
  type FieldError,
} from "@/lib/contacts/validation";

/** Ledger Wallet's address entry: the address, then the name shown on device. */
export const AddressFields: React.FC<{
  placeholder: string;
  address: string;
  addressCheck: AddressCheck;
  onAddressChange: (address: string) => void;
  label: string;
  labelError: FieldError;
  onLabelChange: (label: string) => void;
}> = ({
  placeholder,
  address,
  addressCheck,
  onAddressChange,
  label,
  labelError,
  onLabelChange,
}) => {
  let addressHelper: string | undefined;
  if (addressCheck.status === "invalid") addressHelper = addressCheck.message;
  else if (addressCheck.status === "valid") addressHelper = "Valid address";

  return (
    <div className="flex flex-col gap-24">
      <AddressInput
        autoFocus
        autoComplete="off"
        spellCheck={false}
        prefix=""
        placeholder={placeholder}
        value={address}
        status={
          addressCheck.status === "invalid"
            ? "error"
            : addressCheck.status === "valid"
              ? "success"
              : undefined
        }
        helperText={addressHelper}
        onChange={(event) => onAddressChange(event.target.value)}
        onClear={() => onAddressChange("")}
        data-testid="contacts-address-input"
      />
      <TextInput
        autoComplete="off"
        spellCheck={false}
        hideClearButton
        label="Address name"
        value={label}
        maxCount={CONTACT_ADDRESS_LABEL_MAX_LENGTH}
        maxLength={CONTACT_ADDRESS_LABEL_MAX_LENGTH}
        status={labelError ? "error" : undefined}
        helperText={labelError}
        onChange={(event) => onLabelChange(event.target.value)}
        suffix={
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="flex text-muted"
                aria-label="Address name information"
              >
                <InformationFill size={20} />
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px]">
              This name appears on your Ledger device when you send to this
              address. Give it a name that makes it easy to find.
            </TooltipContent>
          </Tooltip>
        }
        data-testid="contacts-address-name-input"
      />
    </div>
  );
};
