import { createHandlers } from "../handlers";

// Constants
export const PREFIX = "dmk>";

export interface Command {
  name: keyof ReturnType<typeof createHandlers>;
  description: string;
  flags: string[];
}

export const commands: Command[] = [
  {
    name: "version",
    description: "Display the current version of the DMK",
    flags: [],
  },
  {
    name: "connect",
    description: "Connect to a device",
    flags: [],
  },
  {
    name: "sendApdu",
    description: "Send a raw APDU to the connected device",
    flags: [],
  },
  {
    name: "sendCommand",
    description: "Send a predefined command to the connected device",
    flags: [],
  },
  {
    name: "executeDeviceAction",
    description: "Execute a device action",
    flags: [],
  }, 
  {
    name: "disconnect",
    description: "Disconnect from the connected device",
    flags: [],
  },
  {
    name: "exit",
    description: "Exit DMK CLI",
    flags: [],
  },
];

export type ListenForCommand = () => Promise<void>;
