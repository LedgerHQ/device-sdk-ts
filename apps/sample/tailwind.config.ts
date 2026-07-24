import { ledgerLivePreset } from "@ledgerhq/lumen-design-core";

/**
 * Tailwind config scoped to Lumen usage only.
 *
 * The sample app still relies on @ledgerhq/react-ui + styled-components for
 * everything except the home page device buttons. Tailwind preflight is
 * intentionally NOT loaded (see src/styles/lumen.css) so it does not reset the
 * existing react-ui styling.
 */
const config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@ledgerhq/lumen-ui-react/dist/lib/**/*.{js,ts,jsx,tsx}",
  ],
  presets: [ledgerLivePreset],
};

// eslint-disable-next-line no-restricted-syntax
export default config;
