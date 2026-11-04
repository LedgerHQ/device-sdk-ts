import React from "react";
import {
  type CommandResult,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { cn } from "@ledgerhq/lumen-design-core/cn";
import { Spinner } from "@ledgerhq/lumen-ui-react";

import { HintTooltip } from "@/components/HintTooltip";
import { type FieldType } from "@/hooks/useForm";

export type CommandResponseProps<Response, ErrorCodes> = {
  args: Record<string, FieldType>;
  date: Date;
  loading: boolean;
  response: CommandResult<Response, ErrorCodes> | null;
};

export function CommandResponse<Response, ErrorCodes>(
  props: CommandResponseProps<Response, ErrorCodes> & { isLatest: boolean },
) {
  const { args, date, loading, response, isLatest } = props;
  const responseString = JSON.stringify(response, null, 2);
  const isError = response !== null && !isSuccessCommandResult(response);
  return (
    <div className="flex flex-col items-start">
      <HintTooltip
        hint={
          <span className="whitespace-pre-wrap">
            Arguments:{"\n"}
            {JSON.stringify(args, null, 2)}
          </span>
        }
      >
        <span
          className={cn(
            "grow-0 text-muted",
            isLatest ? "body-3-semi-bold" : "body-3",
          )}
        >
          {date.toLocaleTimeString()}
        </span>
      </HintTooltip>
      {loading ? (
        <Spinner size={20} />
      ) : (
        <span
          className={cn(
            "body-2 whitespace-pre-wrap",
            isError
              ? "text-error"
              : responseString
                ? "text-base"
                : "text-muted",
            !responseString && "italic",
          )}
        >
          {responseString ?? "void"}
        </span>
      )}
    </div>
  );
}
