import React from "react";
import {
  bufferToHexaString,
  type DeviceActionIntermediateValue,
  type DeviceActionState,
  DeviceActionStatus,
  type DeviceModelId,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { cn } from "@ledgerhq/lumen-design-core/cn";
import { Tag } from "@ledgerhq/lumen-ui-react";
import { Information } from "@ledgerhq/lumen-ui-react/symbols";
// eslint-disable-next-line no-restricted-imports -- Next.js polyfills util.inspect in client bundles.
import { inspect } from "util";

import { HintTooltip } from "@/components/HintTooltip";
import { type FieldType } from "@/hooks/useForm";

export type DeviceActionResponseProps<Output, Error, IntermediateValue> = {
  args: Record<string, FieldType>;
  date: Date;
  id: number;
  /** Optional custom component to render the successful output */
  OutputComponent?: React.FC<{
    output: Output;
    deviceModelId: DeviceModelId;
  }>;
  deviceModelId?: DeviceModelId;
} & (
  | {
      deviceActionState: DeviceActionState<Output, Error, IntermediateValue>;
    }
  | { error: unknown }
);

export const deviceActionStatusToColor: Record<DeviceActionStatus, string> = {
  [DeviceActionStatus.NotStarted]: "text-interactive",
  [DeviceActionStatus.Pending]: "text-interactive",
  [DeviceActionStatus.Stopped]: "text-warning",
  [DeviceActionStatus.Completed]: "text-success",
  [DeviceActionStatus.Error]: "text-error",
};

function bufferStringifyReplacer(_key: string, value: unknown): unknown {
  // Pretty-print buffers to make signatures or public keys readable
  if (value instanceof Uint8Array) {
    return bufferToHexaString(value);
  }
  return value;
}

/**
 * Component to display an event emitted by a device action.
 */
function DeviceActionResponseInternal<
  Output,
  Error,
  IntermediateValue extends DeviceActionIntermediateValue,
>(
  props: DeviceActionResponseProps<Output, Error, IntermediateValue> & {
    isLatest: boolean;
  },
) {
  const { args, date, isLatest, id, OutputComponent, deviceModelId } = props;

  const isError = "error" in props;

  // Check if we have a completed state with custom output component
  const showCustomOutput =
    !isError &&
    "deviceActionState" in props &&
    props.deviceActionState.status === DeviceActionStatus.Completed &&
    OutputComponent &&
    deviceModelId &&
    "output" in props.deviceActionState &&
    props.deviceActionState.output !== undefined;

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-start overflow-scroll rounded-md p-8",
        isLatest ? "bg-muted-transparent" : "bg-transparent",
      )}
    >
      <HintTooltip
        hint={
          <span className="whitespace-pre-wrap">
            Arguments:{"\n"}
            {JSON.stringify(args, bufferStringifyReplacer, 2)}
          </span>
        }
      >
        <span
          className={cn(
            "mb-4 grow-0 text-muted",
            isLatest ? "body-3-semi-bold" : "body-3",
          )}
        >
          (execution ID: {id}) {date.toLocaleTimeString()}{" "}
          {isError ? "Error" : ""}
        </span>
      </HintTooltip>
      {showCustomOutput ? (
        <div className="flex flex-col mt-4 w-full">
          <span className="body-3 text-success mb-4">Status: Completed</span>
          <OutputComponent
            output={
              (props as { deviceActionState: { output: Output } })
                .deviceActionState.output
            }
            deviceModelId={deviceModelId!}
          />
        </div>
      ) : (
        <span
          className={cn(
            "body-2 break-words whitespace-pre-wrap",
            deviceActionStatusToColor[
              isError
                ? DeviceActionStatus.Error
                : props.deviceActionState.status
            ],
          )}
        >
          {isError
            ? inspect(props.error, { depth: null })
            : props.deviceActionState.status === DeviceActionStatus.Error
              ? inspect(props.deviceActionState.error, { depth: null })
              : JSON.stringify(
                  props.deviceActionState,
                  bufferStringifyReplacer,
                  2,
                )}
        </span>
      )}
      {!isError &&
      props.deviceActionState.status === DeviceActionStatus.Pending ? (
        props.deviceActionState.intermediateValue?.requiredUserInteraction !==
        UserInteractionRequired.None ? (
          <div className="flex flex-row items-center mt-12 gap-x-4">
            <Information size={24} className="text-base" />
            <span className="body-2">User action required: </span>
            <Tag
              appearance="gray"
              size="sm"
              label={String(
                props.deviceActionState.intermediateValue
                  .requiredUserInteraction,
              )}
            />
          </div>
        ) : null
      ) : null}
    </div>
  );
}

export const DeviceActionResponse = React.memo(
  DeviceActionResponseInternal,
) as typeof DeviceActionResponseInternal;
