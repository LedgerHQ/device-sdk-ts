import { type DitheringAlgorithm } from "@ledgerhq/dmk-ledger-wallet";

export const DITHERING_OPTIONS: Array<{
  label: string;
  value: DitheringAlgorithm;
}> = [
  { label: "Floyd-Steinberg", value: "floyd-steinberg" },
  { label: "Atkinson", value: "atkinson" },
  { label: "Reduced Atkinson", value: "reduced-atkinson" },
];
