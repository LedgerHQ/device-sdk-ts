import { createHandlers } from "../handlers";

// Constants
export const PREFIX = "dmk>";

export type ConnectionMode = "connected" | "disconnected" | "both";

export interface Command {
  name: keyof ReturnType<typeof createHandlers>;
  description: string;
  flags: string[];
  connectionMode: ConnectionMode;
}

export const commands: Command[] = [
  {
    name: "version",
    description: "Display the current version of the DMK",
    flags: [],
    connectionMode: "both",
  },
  {
    name: "connect",
    description: "Connect to a device",
    flags: [],
    connectionMode: "disconnected",
  },
  {
    name: "sendApdu",
    description: "Send a raw APDU to the connected device",
    flags: [],
    connectionMode: "connected",
  },
  {
    name: "sendCommand",
    description: "Send a predefined command to the connected device",
    flags: [],
    connectionMode: "connected",
  },
  {
    name: "executeDeviceAction",
    description: "Execute a device action",
    flags: [],
    connectionMode: "connected",
  },
  {
    name: "disconnect",
    description: "Disconnect from the connected device",
    flags: [],
    connectionMode: "connected",
  },
  {
    name: "exit",
    description: "Exit DMK CLI",
    flags: [],
    connectionMode: "disconnected",
  },
];

export function getAvailableCommands(isConnected: boolean): Command[] {
  return commands.filter(
    (cmd) =>
      cmd.connectionMode === "both" ||
      cmd.connectionMode === (isConnected ? "connected" : "disconnected"),
  );
}

export type ListenForCommand = () => Promise<void>;
