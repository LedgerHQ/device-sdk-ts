import React from "react";
import {
  Apps,
  CloudUpload,
  Code,
  LedgerDevices,
  LedgerLogo,
  ListEye,
  SettingsAlt2,
  Signature,
  TransferHorizontal,
  User,
} from "@ledgerhq/lumen-ui-react/symbols";
import { useRouter } from "next/navigation";

const ITEMS = [
  {
    route: "/apdu",
    icon: TransferHorizontal,
    label: "APDU",
    testId: "CTA_route-to-/apdu",
  },
  {
    route: "/commands",
    icon: Code,
    label: "Commands",
    testId: "CTA_route-to-/commands",
  },
  {
    route: "/device-actions",
    icon: LedgerDevices,
    label: "Device Actions",
    testId: "CTA_route-to-/device-actions",
  },
  {
    route: "/ledger-wallet",
    icon: LedgerLogo,
    label: "Ledger Wallet",
    testId: "CTA_route-to-/ledger-wallet",
  },
  {
    route: "/signers",
    icon: Signature,
    label: "Signer Kits",
    testId: "CTA_route-to-/signers",
  },
  {
    route: "/contacts",
    icon: User,
    label: "Contacts",
    testId: "CTA_route-to-/contacts",
  },
  {
    route: "/trusted-apps",
    icon: Apps,
    label: "Trusted Apps",
    testId: "CTA_route-to-/trusted-apps",
  },
  {
    route: "/clear-signing-tools",
    icon: ListEye,
    label: "Clear Signing Tools",
    testId: "CTA_route-to-/clear-signing-tools",
  },
  {
    route: "/internal-tools",
    icon: CloudUpload,
    label: "Ledger Internal Tools",
    testId: "CTA_route-to-/internal-tools",
  },
  {
    route: "/settings",
    icon: SettingsAlt2,
    label: "Settings",
    testId: undefined,
  },
];

export const Menu: React.FC = () => {
  const router = useRouter();

  return (
    <>
      {ITEMS.map(({ route, icon: Icon, label, testId }) => (
        <button
          key={route}
          data-testid={testId}
          className="flex cursor-pointer flex-row border-0 bg-transparent items-center gap-12 rounded-sm py-8 pr-8 pl-12 text-left text-base hover:bg-surface-hover"
          onClick={() => router.push(route)}
        >
          <Icon size={24} />
          <span className="body-2-semi-bold">{label}</span>
        </button>
      ))}
    </>
  );
};
