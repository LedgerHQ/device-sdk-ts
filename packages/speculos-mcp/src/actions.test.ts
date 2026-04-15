import { describe, expect, it, type Mock, vi } from "vitest";

import {
  approveFlow,
  enableBlindSigning,
  handleBlindSigningWarning,
  handleTransactionCheckOptIn,
  rejectFlow,
} from "./actions";
import type { SigningState } from "./dmk-session";
import type { ScreenEvent } from "./screen-events";
import type { SpeculosClient } from "./speculos-client";

vi.useFakeTimers();

function event(text: string, x = 0, y = 0, w = 100, h = 32): ScreenEvent {
  return { text, x, y, w, h };
}

function mockClient(
  overrides: Partial<Record<keyof SpeculosClient, Mock>> = {},
): SpeculosClient {
  return {
    checkConnection: vi.fn(),
    fetchEvents: vi.fn().mockResolvedValue([]),
    fetchScreenshot: vi.fn(),
    tap: vi.fn(),
    setDevice: vi.fn(),
    navigate: vi.fn(),
    sign: vi.fn(),
    reject: vi.fn(),
    confirm: vi.fn(),
    dismissSecondary: vi.fn(),
    ...overrides,
  };
}

function signingState(status: SigningState["status"]): () => SigningState {
  if (status === "completed") {
    return () =>
      ({
        status: "completed",
        signature: { r: "0x1", s: "0x2", v: 27 },
      }) as SigningState;
  }
  if (status === "error") {
    return () => ({ status: "error", error: "User rejected" });
  }
  if (status === "stopped") {
    return () => ({ status: "stopped" });
  }
  return () => ({
    status: "pending",
    step: "review",
    requiredUserInteraction: "Sign",
  });
}

describe("actions", () => {
  describe("approveFlow", () => {
    it("returns error when no sign button is found", async () => {
      const client = mockClient({
        fetchEvents: vi.fn().mockResolvedValue([event("Review transaction")]),
      });

      const promise = approveFlow(client, signingState("pending"), 3);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.screen).toContain("No sign button found");
      expect(client.sign).not.toHaveBeenCalled();
    });

    it("signs and returns completed state", async () => {
      const client = mockClient({
        fetchEvents: vi
          .fn()
          .mockResolvedValueOnce([event("Hold to sign"), event("Reject")])
          // waitForScreenChange poll returns changed screen
          .mockResolvedValueOnce([event("Signing...")])
          // final fetchEvents after pollForSigningComplete
          .mockResolvedValueOnce([event("Signed")]),
        sign: vi.fn().mockResolvedValue(undefined),
      });

      const promise = approveFlow(client, signingState("completed"), 3);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(client.sign).toHaveBeenCalledWith(3000);
      expect(result.signingStatus?.status).toBe("completed");
      expect(result.screen).toContain("signing_status");
    });

    it("returns incomplete message when signing does not complete in time", async () => {
      const client = mockClient({
        fetchEvents: vi
          .fn()
          .mockResolvedValueOnce([event("Hold to sign")])
          // waitForScreenChange poll returns changed screen
          .mockResolvedValueOnce([event("Processing")])
          // final fetchEvents
          .mockResolvedValueOnce([event("Processing")]),
        sign: vi.fn().mockResolvedValue(undefined),
      });

      const promise = approveFlow(client, signingState("pending"), 3);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.screen).toContain(
        "Approval sent, signing not yet complete",
      );
      expect(result.signingStatus).toBeUndefined();
    });
  });

  describe("rejectFlow", () => {
    it("confirms rejection when already on Yes, reject screen", async () => {
      const client = mockClient({
        fetchEvents: vi
          .fn()
          .mockResolvedValueOnce([event("Yes, reject transaction")])
          // waitForScreenChange poll returns changed screen
          .mockResolvedValueOnce([event("Transaction cancelled")])
          // final fetchEvents
          .mockResolvedValueOnce([event("Transaction cancelled")]),
        confirm: vi.fn().mockResolvedValue(undefined),
      });

      const promise = rejectFlow(client, signingState("stopped"));
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(client.confirm).toHaveBeenCalled();
      expect(result.screen).toContain("Transaction rejected");
      expect(result.signingStatus?.status).toBe("stopped");
    });

    it("rejects and then confirms the confirmation dialog", async () => {
      const client = mockClient({
        fetchEvents: vi
          .fn()
          // initial read
          .mockResolvedValueOnce([event("Hold to sign"), event("Reject")])
          // waitForScreenChange after reject
          .mockResolvedValueOnce([
            event("Reject transaction?"),
            event("Yes, reject"),
          ])
          // waitForScreenChange after confirm
          .mockResolvedValueOnce([event("Transaction cancelled")])
          // final fetchEvents
          .mockResolvedValueOnce([event("Transaction cancelled")]),
        reject: vi.fn().mockResolvedValue(undefined),
        confirm: vi.fn().mockResolvedValue(undefined),
      });

      const promise = rejectFlow(client, signingState("error"));
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(client.reject).toHaveBeenCalled();
      expect(client.confirm).toHaveBeenCalled();
      expect(result.screen).toContain("Transaction rejected");
    });

    it("returns error when no reject button is found", async () => {
      const client = mockClient({
        fetchEvents: vi.fn().mockResolvedValue([event("Review transaction")]),
      });

      const promise = rejectFlow(client, signingState("pending"));
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.screen).toContain("No Reject button found");
    });

    it("returns incomplete message when rejection does not complete in time", async () => {
      const client = mockClient({
        fetchEvents: vi
          .fn()
          // initial read
          .mockResolvedValueOnce([event("Hold to sign"), event("Reject")])
          // waitForScreenChange after reject
          .mockResolvedValueOnce([event("Rejecting...")])
          // final fetchEvents
          .mockResolvedValueOnce([event("Rejecting...")]),
        reject: vi.fn().mockResolvedValue(undefined),
      });

      const promise = rejectFlow(client, signingState("pending"));
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.screen).toContain("Rejection sent");
      expect(result.signingStatus).toBeUndefined();
    });
  });

  describe("handleTransactionCheckOptIn", () => {
    it("returns not dismissed when no Maybe later button", async () => {
      const client = mockClient();
      const events = [event("Review transaction")];

      const promise = handleTransactionCheckOptIn(client, events, false);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.dismissed).toBe(false);
      expect(result.events).toBe(events);
    });

    it("dismisses via secondary button when enable=false", async () => {
      const freshEvents = [event("Review screen")];
      const client = mockClient({
        fetchEvents: vi.fn().mockResolvedValue(freshEvents),
        dismissSecondary: vi.fn().mockResolvedValue(undefined),
      });

      const promise = handleTransactionCheckOptIn(
        client,
        [event("Enable transaction check?"), event("Maybe later")],
        false,
      );
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.dismissed).toBe(true);
      expect(result.enabled).toBe(false);
      expect(client.dismissSecondary).toHaveBeenCalled();
      expect(client.confirm).not.toHaveBeenCalled();
      expect(result.events).toBe(freshEvents);
    });

    it("confirms when enable=true", async () => {
      const freshEvents = [event("Enabled")];
      const client = mockClient({
        fetchEvents: vi.fn().mockResolvedValue(freshEvents),
        confirm: vi.fn().mockResolvedValue(undefined),
      });

      const promise = handleTransactionCheckOptIn(
        client,
        [event("Enable transaction check?"), event("Maybe later")],
        true,
      );
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.dismissed).toBe(true);
      expect(result.enabled).toBe(true);
      expect(client.confirm).toHaveBeenCalled();
    });
  });

  describe("handleBlindSigningWarning", () => {
    it("returns not dismissed when no warning is present", async () => {
      const client = mockClient();
      const events = [event("Review transaction")];

      const promise = handleBlindSigningWarning(client, events, false);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.dismissed).toBe(false);
    });

    it("accepts blind signing via confirm", async () => {
      const freshEvents = [event("Blind signed screen")];
      const client = mockClient({
        fetchEvents: vi.fn().mockResolvedValue(freshEvents),
        confirm: vi.fn().mockResolvedValue(undefined),
      });

      const promise = handleBlindSigningWarning(
        client,
        [
          event("Blind signing ahead"),
          event("Accept risk and continue"),
          event("Back to safety"),
        ],
        true,
      );
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.dismissed).toBe(true);
      expect(result.accepted).toBe(true);
      expect(client.confirm).toHaveBeenCalled();
    });

    it("rejects blind signing via dismissSecondary (back to safety)", async () => {
      const freshEvents = [event("Safe screen")];
      const client = mockClient({
        fetchEvents: vi.fn().mockResolvedValue(freshEvents),
        dismissSecondary: vi.fn().mockResolvedValue(undefined),
      });

      const promise = handleBlindSigningWarning(
        client,
        [
          event("Blind signing ahead"),
          event("Accept risk and continue"),
          event("Back to safety"),
        ],
        false,
      );
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.dismissed).toBe(true);
      expect(result.accepted).toBe(false);
      expect(client.dismissSecondary).toHaveBeenCalled();
      expect(client.confirm).not.toHaveBeenCalled();
    });

    it("returns not dismissed when warning present but no action button found", async () => {
      const client = mockClient();

      const promise = handleBlindSigningWarning(
        client,
        [event("Blind signing ahead")],
        true,
      );
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.dismissed).toBe(false);
    });
  });

  describe("enableBlindSigning", () => {
    it("rejects transaction when enable=false and Reject transaction button exists", async () => {
      const freshEvents = [event("Home")];
      const client = mockClient({
        fetchEvents: vi
          .fn()
          // initial fetchEvents
          .mockResolvedValueOnce([
            event("Go to settings"),
            event("Reject transaction"),
          ])
          // waitForScreenChange after reject
          .mockResolvedValueOnce(freshEvents),
        reject: vi.fn().mockResolvedValue(undefined),
      });

      const promise = enableBlindSigning(client, false);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(client.reject).toHaveBeenCalled();
      expect(result.events).toBe(freshEvents);
    });

    it("returns failure when enable=false and no Reject transaction button", async () => {
      const client = mockClient({
        fetchEvents: vi.fn().mockResolvedValue([event("Go to settings")]),
      });

      const promise = enableBlindSigning(client, false);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
    });

    it("navigates to settings and enables blind signing when enable=true", async () => {
      const finalEvents = [event("Blind signing enabled")];
      const client = mockClient({
        fetchEvents: vi
          .fn()
          // initial fetchEvents
          .mockResolvedValueOnce([
            event("Go to settings"),
            event("Reject transaction"),
          ])
          // waitForScreenChange after confirm (go to settings)
          .mockResolvedValueOnce([event("Blind signing")])
          // waitForScreenChange after confirm (toggle)
          .mockResolvedValueOnce([event("Confirmation dialog")])
          // waitForScreenChange after dismissSecondary
          .mockResolvedValueOnce(finalEvents),
        confirm: vi.fn().mockResolvedValue(undefined),
        dismissSecondary: vi.fn().mockResolvedValue(undefined),
      });

      const promise = enableBlindSigning(client, true);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(client.confirm).toHaveBeenCalledTimes(2);
      expect(client.dismissSecondary).toHaveBeenCalledTimes(1);
      expect(result.events).toBe(finalEvents);
    });

    it("returns failure when Go to settings button not found", async () => {
      const client = mockClient({
        fetchEvents: vi.fn().mockResolvedValue([event("Some other screen")]),
      });

      const promise = enableBlindSigning(client, true);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
    });

    it("returns failure when Blind signing toggle not found in settings", async () => {
      const settingsEvents = [event("Some settings")];
      const client = mockClient({
        fetchEvents: vi
          .fn()
          // initial fetchEvents
          .mockResolvedValueOnce([event("Go to settings")])
          // waitForScreenChange after confirm
          .mockResolvedValueOnce(settingsEvents),
        confirm: vi.fn().mockResolvedValue(undefined),
      });

      const promise = enableBlindSigning(client, true);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.events).toBe(settingsEvents);
    });
  });
});
