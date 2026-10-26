// The transport role: packages/transport/*.
// The 7 transports use 4 layouts, so the base role only fixes the entry points.

const transportBase = {
  name: "transport",
  group: "transport",
  kind: "transport",
  tree: {
    webFamily: false,
    allowedFolders: null,
  },
};

// Variant for the web family layout (web-hid, web-ble, node-hid, rn-ble):
// src/api/transport/<X>Transport.ts, <X>ApduSender.ts and src/api/model/Errors.ts.
const webFamily = {
  ...transportBase,
  name: "transport.webFamily",
  tree: {
    webFamily: true,
    allowedFolders: {
      src: ["api"],
      "src/api": ["data", "model", "transport"],
    },
  },
};

export const transport = Object.freeze({
  ...transportBase,
  webFamily: Object.freeze(webFamily),
});
