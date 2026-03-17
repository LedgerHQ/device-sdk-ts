import {
  BLIND_SIGNING_ACCEPT_PATTERNS,
  BLIND_SIGNING_REJECT_PATTERNS,
  BLIND_SIGNING_WARNING_PATTERNS,
  DELAY,
  GO_TO_SETTINGS_PATTERNS,
  SETTINGS_BLIND_SIGNING_PATTERNS,
} from "./constants";
import type { SigningState } from "./dmk-session";
import {
  eventsEqual,
  findConfirmRejectButton,
  findEvent,
  findRejectButton,
  findSignButton,
  formatEvents,
  type ScreenEvent,
} from "./screen-events";
import type { SpeculosClient } from "./speculos-client";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitForScreenChange(
  client: SpeculosClient,
  previousEvents: ScreenEvent[],
  timeoutMs = DELAY.screenChangeTimeoutMs,
  pollMs = DELAY.screenChangePollMs,
): Promise<ScreenEvent[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = await client.fetchEvents();
    if (!eventsEqual(previousEvents, current)) {
      return current;
    }
    await sleep(pollMs);
  }
  return client.fetchEvents();
}

export type ActionResult = {
  screen: string;
  signingStatus?: SigningState;
};

async function pollForSigningComplete(
  getState: () => SigningState,
  terminalStatuses: SigningState["status"][],
  maxAttempts: number,
  intervalMs: number,
): Promise<SigningState | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const state = getState();
    if (terminalStatuses.includes(state.status)) {
      return state;
    }
    await sleep(intervalMs);
  }
  return null;
}

export type OptInResult = {
  dismissed: boolean;
  enabled?: boolean;
  events: ScreenEvent[];
};

export async function handleTransactionCheckOptIn(
  client: SpeculosClient,
  events: ScreenEvent[],
  enable: boolean,
): Promise<OptInResult> {
  const maybeLater = findEvent(events, /^maybe later$/i);
  if (!maybeLater) {
    return { dismissed: false, events };
  }

  if (enable) {
    await client.confirm();
  } else {
    await client.dismissSecondary();
  }

  const freshEvents = await waitForScreenChange(client, events);
  return { dismissed: true, enabled: enable, events: freshEvents };
}

export type BlindSigningResult = {
  dismissed: boolean;
  accepted?: boolean;
  events: ScreenEvent[];
};

export async function handleBlindSigningWarning(
  client: SpeculosClient,
  events: ScreenEvent[],
  accept: boolean,
): Promise<BlindSigningResult> {
  const warning = BLIND_SIGNING_WARNING_PATTERNS.map((p) =>
    findEvent(events, p),
  ).find(Boolean);
  if (!warning) {
    return { dismissed: false, events };
  }

  const patterns = accept
    ? BLIND_SIGNING_ACCEPT_PATTERNS
    : BLIND_SIGNING_REJECT_PATTERNS;
  const target = patterns.map((p) => findEvent(events, p)).find(Boolean);

  if (!target) {
    return { dismissed: false, events };
  }

  if (accept) {
    await client.confirm();
  } else {
    await client.dismissSecondary();
  }

  const freshEvents = await waitForScreenChange(client, events);
  return { dismissed: true, accepted: accept, events: freshEvents };
}

export type EnableBlindSigningResult = {
  success: boolean;
  events: ScreenEvent[];
};

export async function enableBlindSigning(
  client: SpeculosClient,
  enable: boolean,
): Promise<EnableBlindSigningResult> {
  const events = await client.fetchEvents();

  if (!enable) {
    const rejectBtn = findEvent(events, /^reject transaction$/i);
    if (!rejectBtn) {
      return { success: false, events };
    }
    await client.reject();
    const freshEvents = await waitForScreenChange(client, events);
    return { success: true, events: freshEvents };
  }

  const goToSettings = GO_TO_SETTINGS_PATTERNS.map((p) =>
    findEvent(events, p),
  ).find(Boolean);
  if (!goToSettings) {
    return { success: false, events };
  }

  await client.confirm();
  const settingsEvents = await waitForScreenChange(client, events);

  const blindSigningToggle = SETTINGS_BLIND_SIGNING_PATTERNS.map((p) =>
    findEvent(settingsEvents, p),
  ).find(Boolean);
  if (!blindSigningToggle) {
    return { success: false, events: settingsEvents };
  }

  await client.confirm();
  const afterToggleEvents = await waitForScreenChange(client, settingsEvents);

  await client.dismissSecondary();
  const freshEvents = await waitForScreenChange(client, afterToggleEvents);
  return { success: true, events: freshEvents };
}

export async function waitForDeviceScreen(
  client: SpeculosClient,
  timeoutMs = 15000,
  pollMs = 500,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const events = await client.fetchEvents();
    const screen = formatEvents(events).toLowerCase();
    if (!screen.includes("quit app") && events.length > 0) {
      return;
    }
    await sleep(pollMs);
  }
}

export async function performNavigate(
  client: SpeculosClient,
  direction: "next" | "previous",
): Promise<void> {
  await client.navigate(direction);
}

export async function approveFlow(
  client: SpeculosClient,
  getSigningState: () => SigningState,
  holdSeconds: number,
): Promise<ActionResult> {
  const events = await client.fetchEvents();
  const signButton = findSignButton(events);

  if (!signButton) {
    return {
      screen: `No sign button found.\n${formatEvents(events)}`,
    };
  }

  await client.sign(holdSeconds * 1000);
  await waitForScreenChange(client, events);

  const state = await pollForSigningComplete(
    getSigningState,
    ["completed", "error", "stopped"],
    10,
    DELAY.pollInterval,
  );

  const finalEvents = await client.fetchEvents();
  const screen = formatEvents(finalEvents);

  if (state) {
    return {
      screen: `${screen}\n---\nsigning_status: ${JSON.stringify(state)}`,
      signingStatus: state,
    };
  }

  return {
    screen: `Approval sent, signing not yet complete.\n${screen}`,
  };
}

export async function rejectFlow(
  client: SpeculosClient,
  getSigningState: () => SigningState,
): Promise<ActionResult> {
  let events = await client.fetchEvents();

  const confirmRejectButton = findEvent(events, /yes.+reject/i);
  if (confirmRejectButton) {
    await client.confirm();
    await waitForScreenChange(client, events);

    const state = await pollForSigningComplete(
      getSigningState,
      ["error", "stopped"],
      5,
      DELAY.pollInterval,
    );

    const finalEvents = await client.fetchEvents();
    const screen = formatEvents(finalEvents);

    if (state) {
      return {
        screen: `Transaction rejected.\n${screen}\n---\nsigning_status: ${JSON.stringify(state)}`,
        signingStatus: state,
      };
    }

    return {
      screen: `Rejection confirmed.\n${screen}`,
    };
  }

  const rejectButton = findRejectButton(events);
  if (!rejectButton) {
    return {
      screen: `No Reject button found.\n${formatEvents(events)}`,
    };
  }

  await client.reject();
  events = await waitForScreenChange(client, events);

  const confirmButton = findConfirmRejectButton(events);
  if (confirmButton) {
    await client.confirm();
    await waitForScreenChange(client, events);
  }

  const state = await pollForSigningComplete(
    getSigningState,
    ["error", "stopped"],
    5,
    DELAY.pollInterval,
  );

  const finalEvents = await client.fetchEvents();
  const screen = formatEvents(finalEvents);

  if (state) {
    return {
      screen: `Transaction rejected.\n${screen}\n---\nsigning_status: ${JSON.stringify(state)}`,
      signingStatus: state,
    };
  }

  return {
    screen: `Rejection sent.\n${screen}`,
  };
}
