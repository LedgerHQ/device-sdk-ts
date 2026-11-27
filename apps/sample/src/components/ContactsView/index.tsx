import React, { useState } from "react";
import { Button, ThemeProvider } from "@ledgerhq/lumen-ui-react";
import { ArrowLeft } from "@ledgerhq/lumen-ui-react/symbols";

import { AddressBookProvider } from "@/components/ContactsView/AddressBookStore";
import { AdvancedTesters } from "@/components/ContactsView/AdvancedTesters";
import { ContactsPage } from "@/components/ContactsView/ContactsPage";
import { SessionIdWrapper } from "@/components/SessionIdWrapper";

/**
 * The Contacts playground: a Ledger Wallet-like Contacts page, and an advanced
 * mode with the raw testers of the four device operations. Both work on the
 * same persisted address book. The page needs no device until an operation
 * reaches the device step.
 */
export const ContactsView: React.FC = () => {
  const [advanced, setAdvanced] = useState(false);
  return (
    <ThemeProvider colorScheme="dark">
      <AddressBookProvider>
        {advanced ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="px-24 pt-16">
              <Button
                appearance="gray"
                size="sm"
                icon={ArrowLeft}
                onClick={() => setAdvanced(false)}
                data-testid="contacts-advanced-back"
              >
                Back to contacts
              </Button>
            </div>
            <SessionIdWrapper ChildComponent={AdvancedTesters} />
          </div>
        ) : (
          <ContactsPage onShowAdvanced={() => setAdvanced(true)} />
        )}
      </AddressBookProvider>
    </ThemeProvider>
  );
};
