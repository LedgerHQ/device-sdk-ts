#!/usr/bin/env tsx
import "zx/globals";
import { usePowerShell } from "zx";
import { select } from "@inquirer/prompts";
import { getAvailableCommands, logInfo, type Command } from "./utils";
import { createHandlers } from "./handlers";
import { listenToAvailableDevices } from "./services";
import { type Subscription } from "rxjs";
import { state } from "./state";
import { resetDmk } from "./services/Dmk";


let handlers: ReturnType<typeof createHandlers> | null = null;

async function listenForCommand(): Promise<void> {
  const isConnected = state.sessionId !== null;
  const availableCommands = getAvailableCommands(isConnected);

  const selectedCommandName = await select<Command["name"]>({
    message: "Which command would you like to run?",
    choices: availableCommands.map((command) => ({
      name: command.description,
      value: command.name,
    })),
  });

  if (!handlers) {
    handlers = createHandlers(listenForCommand);
  }

  const handler = handlers[selectedCommandName as keyof typeof handlers];
  return handler();
}

let subscription : Subscription | null = null;

function cleanup(): void {
  state.subscriptions.forEach((subscription) => {
    subscription.unsubscribe();
  });
  state.subscriptions.length = 0;
  
  resetDmk();
}

if (process.platform === "win32") {
  usePowerShell();
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

async function main(): Promise<void> {
  subscription = listenToAvailableDevices();
  state.subscriptions.push(subscription);
  try {
      await new Promise((resolve) => setTimeout(resolve, 200));
      logInfo("\nWelcome to the DMK CLI!\n");
      await listenForCommand();
    } finally {
      cleanup();
      process.exit(0);
    }
}

main().catch((error) => {
  cleanup();
  throw error;
});
