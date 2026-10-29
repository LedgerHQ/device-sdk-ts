import React, { useMemo, useState } from "react";
import { IconButton } from "@ledgerhq/lumen-ui-react";
import { Check, ChevronRight, Copy } from "@ledgerhq/lumen-ui-react/symbols";

import { type LogData } from "./types";

type Branch = Record<string, unknown> | unknown[];

const MAX_PREVIEW_ENTRIES = 4;
const MAX_PREVIEW_STRING = 24;
const AUTO_OPEN_DEPTH = 2;
const AUTO_OPEN_MAX_ENTRIES = 8;

const isBranch = (value: unknown): value is Branch =>
  typeof value === "object" && value !== null;

const CopyButton: React.FC<{ text: string; label: string }> = ({
  text,
  label,
}) => {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      aria-label={label}
      title={label}
      icon={copied ? Check : Copy}
      size="xs"
      appearance="no-background"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    />
  );
};

const Primitive: React.FC<{ value: unknown; short?: boolean }> = ({
  value,
  short = false,
}) => {
  if (typeof value === "string") {
    const text =
      short && value.length > MAX_PREVIEW_STRING
        ? `${value.slice(0, MAX_PREVIEW_STRING)}…`
        : value;
    return (
      <span className={short ? "text-base" : "break-all text-base"}>
        {`"${text}"`}
      </span>
    );
  }
  if (value === null || value === undefined) {
    return <span className="text-muted">{String(value)}</span>;
  }
  return <span className="text-decorative-blue">{String(value)}</span>;
};

/** One-line summary of a branch, like the browser console's. */
const Preview: React.FC<{ value: Branch }> = ({ value }) => {
  const entries = Object.entries(value);
  const shown = entries.slice(0, MAX_PREVIEW_ENTRIES);
  const isArray = Array.isArray(value);
  return (
    <span className="text-muted">
      {isArray ? `(${entries.length}) [` : "{"}
      {shown.map(([key, child], index) => (
        <React.Fragment key={key}>
          {index > 0 && ", "}
          {!isArray && <span className="text-decorative-purple">{key}: </span>}
          {isBranch(child) ? (
            Array.isArray(child) ? (
              `Array(${child.length})`
            ) : (
              "{…}"
            )
          ) : (
            <Primitive value={child} short />
          )}
        </React.Fragment>
      ))}
      {entries.length > shown.length && ", …"}
      {isArray ? "]" : "}"}
    </span>
  );
};

const TOGGLE_SLOT =
  "mr-4 inline-flex size-12 items-center justify-center align-middle";

const Toggle: React.FC<{ open: boolean; onToggle: () => void }> = ({
  open,
  onToggle,
}) => (
  <button
    type="button"
    aria-expanded={open}
    aria-label={open ? "Collapse" : "Expand"}
    onClick={onToggle}
    className={`${TOGGLE_SLOT} cursor-pointer text-muted hover:text-base`}
  >
    <ChevronRight
      size={12}
      className={`transition-transform ${open ? "rotate-90" : ""}`}
    />
  </button>
);

const Node: React.FC<{ name?: string; value: unknown; depth: number }> = ({
  name,
  value,
  depth,
}) => {
  const branch = isBranch(value);
  const [open, setOpen] = useState(
    () =>
      branch &&
      depth < AUTO_OPEN_DEPTH &&
      Object.keys(value).length <= AUTO_OPEN_MAX_ENTRIES,
  );
  const label =
    name === undefined ? null : (
      <span className="text-decorative-purple">{name}: </span>
    );

  if (!branch) {
    return (
      <div>
        <span className={TOGGLE_SLOT} />
        {label}
        <Primitive value={value} />
      </div>
    );
  }

  return (
    <div>
      <div>
        <Toggle open={open} onToggle={() => setOpen(!open)} />
        {label}
        {open ? (
          <span className="text-muted">
            {Array.isArray(value) ? `Array(${value.length})` : "{…}"}
          </span>
        ) : (
          <Preview value={value} />
        )}
      </div>
      {open && (
        <div className="pl-16">
          {Object.entries(value).map(([key, child]) => (
            <Node key={key} name={key} value={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const hasPayload = (payload: LogData["payload"]) =>
  typeof payload === "string"
    ? payload.length > 0
    : Object.keys(payload).length > 0;

export const PayloadPreview: React.FC<{ payload: LogData["payload"] }> = ({
  payload,
}) =>
  typeof payload === "string" ? (
    <Primitive value={payload} short />
  ) : (
    <Preview value={payload} />
  );

export const LogPayload: React.FC<{ payload: LogData["payload"] }> = ({
  payload,
}) => {
  const json = useMemo(
    () =>
      typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
    [payload],
  );
  return (
    <div className="group relative rounded-sm bg-muted px-12 py-8 pr-40 font-mono! body-3">
      <div className="absolute top-4 right-4 opacity-0 transition-opacity group-hover:opacity-100">
        <CopyButton text={json} label="Copy payload" />
      </div>
      {typeof payload === "string" ? (
        <Primitive value={payload} />
      ) : (
        Object.entries(payload).map(([key, child]) => (
          <Node key={key} name={key} value={child} depth={1} />
        ))
      )}
    </div>
  );
};
