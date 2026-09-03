export interface MockPreset {
  readonly label: string;
  readonly description: string;
  readonly prefix: string;
  readonly responses: string[];
}

export const MOCK_PRESETS: MockPreset[] = [
  {
    label: "Locked device",
    description:
      "Answers 5515 to GetAppAndVersion, the reply a locked device gives.",
    prefix: "b001",
    responses: ["5515"],
  },
  {
    label: "App not installed",
    description: "Fails every Open App with 6807, as if the app were missing.",
    prefix: "e0d80000",
    responses: ["6807"],
  },
  {
    label: "User rejects on device",
    description:
      "Answers 6985 to Ethereum signing commands (e004…), the user-refused reply.",
    prefix: "e004",
    responses: ["6985"],
  },
  {
    label: "Open App works once",
    description:
      "The first Open App succeeds, the next fails, then it loops — for retry paths.",
    prefix: "e0d80000",
    responses: ["9000", "6807"],
  },
  {
    label: "Device is not genuine",
    description:
      "Answers the genuine check with 0001 instead of 0000, so the device fails it.",
    prefix: "e0f1",
    responses: ["00019000"],
  },
];
