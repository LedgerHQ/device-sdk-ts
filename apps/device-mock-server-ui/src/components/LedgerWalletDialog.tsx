import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  Link,
} from "@ledgerhq/lumen-ui-react";
import { Desktop, Mobile } from "@ledgerhq/lumen-ui-react/symbols";
import { QRCodeSVG } from "qrcode.react";

import { CopyButton } from "@/components/CopyButton";
import { ledgerWalletDeepLink } from "@/domain/ledgerWallet";

interface LedgerWalletDialogProps {
  readonly url: string;
  readonly token: string;
  readonly onClose: () => void;
}

export function LedgerWalletDialog({
  url,
  token,
  onClose,
}: LedgerWalletDialogProps) {
  const deepLink = ledgerWalletDeepLink(url, token);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader
          title="Use in Ledger Wallet"
          description="Open this session in Ledger Wallet."
          onClose={onClose}
        />
        <DialogBody scrollbarWidth="auto">
          <div className="flex flex-col gap-24 pb-24">
            <section className="flex flex-col items-center gap-12">
              <p className="body-2-semi-bold text-base flex items-center gap-8 self-start">
                <Mobile size={20} />
                Ledger Wallet Mobile
              </p>
              {/* Dark on white whatever the theme: scanners need the contrast. */}
              <div className="bg-white rounded-md p-16">
                <QRCodeSVG value={deepLink} size={208} marginSize={0} />
              </div>
              <p className="body-3 text-muted">
                Scan this in Ledger Wallet Mobile
              </p>
            </section>

            <section className="flex flex-col gap-8">
              <p className="body-2-semi-bold text-base flex items-center gap-8">
                <Desktop size={20} />
                Ledger Wallet Desktop
              </p>
              <div className="bg-muted-transparent flex items-center gap-8 rounded-md px-12 py-8">
                {/* asChild: Link's own label span truncates, and the whole link should show. */}
                <Link
                  asChild
                  appearance="accent"
                  className="body-3 min-w-0 flex-1 justify-start font-mono break-all"
                >
                  <a href={deepLink}>{deepLink}</a>
                </Link>
                <CopyButton value={deepLink} label="Copy the link" />
              </div>
            </section>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
