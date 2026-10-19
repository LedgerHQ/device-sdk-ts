/**
 * Maps a Contacts device-action error onto the screen Ledger Wallet shows for
 * it. The taxonomy mirrors Ledger Wallet's contacts failure mapping; the kit
 * never throws, so every failure arrives here as a typed DAError.
 */

export type ContactsOperationKind = "app" | "os";

export type ContactsErrorScreen = Readonly<{
  kind:
    | "rejected"
    | "wrong-device"
    | "invalid-data"
    | "version-too-low"
    | "failed";
  title: string;
  description?: string;
  /** Whether the screen offers Retry (only a refusal leaves the flow open). */
  retryable: boolean;
}>;

function errorTag(error: unknown): string | undefined {
  const tag = (error as { _tag?: unknown } | null)?._tag;
  return typeof tag === "string" ? tag : undefined;
}

function errorCode(error: unknown): string | undefined {
  const code = (error as { errorCode?: unknown } | null)?.errorCode;
  return typeof code === "string" ? code.toLowerCase() : undefined;
}

/** A one-line technical summary, for the sample's error details. */
export function describeContactsError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  const tag = errorTag(error);
  const message = (error as { message?: unknown } | null)?.message;
  const code = errorCode(error);
  return [tag, code ? `0x${code}` : undefined, message]
    .filter((part) => typeof part === "string" && part.length > 0)
    .join(" · ");
}

/**
 * `kind` says who serves the operation: an embedded app (register / edit) or
 * the device OS (rename), which picks the version-guard copy.
 */
export function mapContactsError(
  error: unknown,
  kind: ContactsOperationKind,
): ContactsErrorScreen {
  const tag = errorTag(error);
  const code = errorCode(error);

  if (tag === "ContactsVersionRequirementError") {
    return kind === "os"
      ? {
          kind: "version-too-low",
          title: "Ledger OS update required",
          description:
            "Update your Ledger device's operating system to rename contacts, then try again.",
          retryable: false,
        }
      : {
          kind: "version-too-low",
          title: "App update required",
          description:
            "Update the app on your Ledger device to save contacts, then try again.",
          retryable: false,
        };
  }
  if (
    tag === "ActionRefusedError" ||
    (tag === "ContactsCommandError" && code === "6a80")
  ) {
    return {
      kind: "rejected",
      title: "Operation rejected on Ledger device",
      retryable: true,
    };
  }
  if (tag === "ContactsCommandError" && code === "6982") {
    return {
      kind: "wrong-device",
      title: "Use the same Ledger device you used to add this contact",
      description: "The connected device isn't a match.",
      retryable: false,
    };
  }
  if (
    tag === "ContactsValidationError" ||
    (tag === "ContactsCommandError" && code === "6984")
  ) {
    return {
      kind: "invalid-data",
      title: "This address can't be saved",
      description:
        "Your Ledger device rejected the contact details. Try again or contact Ledger Support if the issue continues.",
      retryable: false,
    };
  }
  return {
    kind: "failed",
    title: "Unknown error",
    description: "Try again or contact Ledger support if the issue continues.",
    retryable: false,
  };
}
