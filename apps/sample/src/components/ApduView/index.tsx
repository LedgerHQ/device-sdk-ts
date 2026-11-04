import React, { useCallback, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { cn } from "@ledgerhq/lumen-design-core/cn";

import { Block } from "@/components/Block";
import { HintTooltip } from "@/components/HintTooltip";
import { PageWithHeader } from "@/components/PageWithHeader";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

import { ApduHistory } from "./ApduHistory";
import { type ApduHistoryItem } from "./ApduResponseView";
import { BuilderModeInput } from "./modeApduBuilder";
import { ResponseParserModeInput } from "./modeApduResponseParser";
import { BulkModeInput } from "./modeBulkApdus";
import { RawHexModeInput } from "./modeRawApdu";

type InputMode = "builder" | "raw" | "bulk" | "parser";

const ModeChip = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button"> & { active: boolean }
>(({ active, className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "body-2-semi-bold cursor-pointer rounded-full border px-16 py-8 transition-all duration-200 hover:border-interactive disabled:cursor-not-allowed disabled:opacity-50",
      active
        ? "border-interactive bg-interactive text-on-interactive"
        : "border-muted-subtle bg-transparent text-muted",
      className,
    )}
    {...props}
  />
));
ModeChip.displayName = "ModeChip";

const MODES: { mode: InputMode; label: string; hint: string }[] = [
  {
    mode: "builder",
    label: "APDU Builder",
    hint: "Build APDU commands using form fields and presets",
  },
  {
    mode: "raw",
    label: "Raw APDU",
    hint: "Send a raw hexadecimal APDU directly",
  },
  {
    mode: "bulk",
    label: "Bulk Exchange APDUs",
    hint: "Send multiple APDUs in sequence",
  },
  {
    mode: "parser",
    label: "APDU Response Parser",
    hint: "Parse and extract fields from APDU responses",
  },
];

export const ApduView: React.FC = () => {
  const [history, setHistory] = useState<ApduHistoryItem[]>([]);
  const nonceRef = useRef(1);
  const [inputMode, setInputMode] = useState<InputMode>("builder");

  const dmk = useDmk();
  const selectedSessionId = useSelector(selectSelectedSessionId);

  const sendApdu = useCallback(
    async (apdu: Uint8Array): Promise<ApduHistoryItem> => {
      const rawApduResponse = await dmk.sendApdu({
        sessionId: selectedSessionId ?? "",
        apdu,
      });

      const newItem: ApduHistoryItem = {
        id: nonceRef.current++,
        date: new Date(),
        rawApduSent: apdu,
        response: rawApduResponse,
      };

      setHistory((prev) => [...prev, newItem]);
      return newItem;
    },
    [dmk, selectedSessionId],
  );

  const handleClearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const isDisabled = !selectedSessionId;

  return (
    <PageWithHeader title="APDU">
      <div className="flex flex-1 flex-col gap-12 overflow-auto pb-20">
        <Block data-testid="form_apdu-input">
          {/* Mode selector */}
          <div className="mb-16 flex flex-row flex-wrap gap-8">
            {MODES.map(({ mode, label, hint }) => (
              <HintTooltip key={mode} hint={hint}>
                <ModeChip
                  active={inputMode === mode}
                  onClick={() => setInputMode(mode)}
                >
                  {label}
                </ModeChip>
              </HintTooltip>
            ))}
          </div>

          {/* Mode components */}
          {inputMode === "builder" && (
            <BuilderModeInput sendApdu={sendApdu} disabled={isDisabled} />
          )}

          {inputMode === "raw" && (
            <RawHexModeInput sendApdu={sendApdu} disabled={isDisabled} />
          )}

          {inputMode === "bulk" && (
            <BulkModeInput sendApdu={sendApdu} disabled={isDisabled} />
          )}

          {inputMode === "parser" && <ResponseParserModeInput />}
        </Block>

        <ApduHistory history={history} onClear={handleClearHistory} />
      </div>
    </PageWithHeader>
  );
};
