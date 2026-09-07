import { ledgerLivePreset } from "@ledgerhq/lumen-design-core";
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  presets: [ledgerLivePreset],
} satisfies Config;
