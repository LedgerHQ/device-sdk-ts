import { type OAS3Definition } from "swagger-jsdoc";

/**
 * Base OpenAPI document for the device mock server.
 *
 * Path operations are described as `@openapi` JSDoc annotations next to their
 * Express handlers (see `src/internal/server/routes/*.ts`) and merged in by
 * `swagger-jsdoc`. The reusable component schemas below mirror the public types
 * exported from `@ledgerhq/device-mockserver-client`; keep them in sync when
 * those change.
 */
export const openapiDefinition: OAS3Definition = {
  openapi: "3.0.3",
  info: {
    title: "Ledger Device Mock Server",
    version: "0.1.0",
    description:
      "In-memory mock of the Ledger device transport contract. Every device " +
      "and mock is scoped to a bearer-token session obtained from `POST /auth`.",
    license: { name: "Apache-2.0" },
  },
  servers: [{ url: "http://127.0.0.1:9752", description: "Local dev server" }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Auth", description: "Session creation" },
    { name: "Sessions", description: "Current session resource" },
    { name: "Devices", description: "Mocked devices and their lifecycle" },
    { name: "Mocks", description: "Canned APDU responses" },
    {
      name: "Speculos",
      description: "Control of the device-linked Speculos emulator",
    },
    { name: "Transfer", description: "Import/export of session state" },
    { name: "Health", description: "Liveness probe" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description:
          "Session token returned by `POST /auth`, sent as " +
          "`Authorization: Bearer <token>`.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
        required: ["error"],
      },
      DeviceApp: {
        type: "object",
        properties: {
          name: { type: "string" },
          version: { type: "string" },
        },
        required: ["name", "version"],
      },
      Device: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          device_type: {
            type: "string",
            description: "DeviceModelId enum value.",
            example: "nanoX",
          },
          connectivity_type: { type: "string", example: "USB" },
          firmware_version: { type: "string" },
          apps: {
            type: "array",
            items: { $ref: "#/components/schemas/DeviceApp" },
          },
          masks: { type: "array", items: { type: "integer" } },
          connected: { type: "boolean" },
        },
        required: ["id", "name", "device_type", "connectivity_type"],
      },
      DeviceConfig: {
        type: "object",
        description: "Payload to attach (POST) or edit (PATCH) a device.",
        properties: {
          name: { type: "string" },
          device_type: { type: "string", example: "nanoX" },
          connectivity_type: { type: "string", example: "USB" },
          firmware_version: { type: "string" },
          apps: {
            type: "array",
            items: { $ref: "#/components/schemas/DeviceApp" },
          },
          masks: { type: "array", items: { type: "integer" } },
          mocks: {
            type: "array",
            description: "Device-scoped APDU mocks (used on attach / import).",
            items: { $ref: "#/components/schemas/MockConfig" },
          },
        },
      },
      Mock: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          prefix: {
            type: "string",
            description: "APDU prefix (hex).",
            example: "b0010000",
          },
          responses: {
            type: "array",
            description:
              "Ordered APDU responses (hex, status word included). Served " +
              "one per matching APDU, looping back to the start once exhausted.",
            items: { type: "string" },
            example: ["0105424f4c4f5309312e342e302d7263329000"],
          },
        },
        required: ["id", "prefix", "responses"],
      },
      MockConfig: {
        type: "object",
        description:
          "Payload to create (POST) or edit (PATCH) a mock. Provide either a " +
          "single `response` or an ordered `responses` list.",
        properties: {
          prefix: { type: "string", example: "b0010000" },
          response: {
            type: "string",
            description:
              "Single-response shorthand for `responses: [response]`.",
            example: "9000",
          },
          responses: {
            type: "array",
            description: "Ordered APDU responses served one per matching APDU.",
            items: { type: "string" },
            example: ["9000", "6985", "9000"],
          },
        },
        required: ["prefix"],
      },
      SessionExport: {
        type: "object",
        description:
          "Portable snapshot of a session's devices (each carrying its own " +
          "mocks), produced by GET /export and consumed by POST /import.",
        properties: {
          devices: {
            type: "array",
            items: { $ref: "#/components/schemas/DeviceConfig" },
          },
        },
        required: ["devices"],
      },
      Session: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          created_at: {
            type: "integer",
            format: "int64",
            description: "Epoch ms.",
          },
          expires_at: {
            type: "integer",
            format: "int64",
            description: "Epoch ms.",
          },
          devices: {
            type: "array",
            items: { $ref: "#/components/schemas/Device" },
          },
        },
        required: ["id", "created_at", "expires_at", "devices"],
      },
      AuthResponse: {
        type: "object",
        properties: {
          token: { type: "string" },
          expires_at: {
            type: "integer",
            format: "int64",
            description: "Epoch ms.",
          },
        },
        required: ["token", "expires_at"],
      },
      ConnectionState: {
        type: "object",
        properties: {
          device: { $ref: "#/components/schemas/Device" },
          connected: { type: "boolean" },
        },
        required: ["device", "connected"],
      },
      ApduRequest: {
        type: "object",
        properties: {
          apdu: {
            type: "string",
            description: "APDU to send (hex).",
            example: "b0010000",
          },
        },
        required: ["apdu"],
      },
      ApduResponse: {
        type: "object",
        properties: {
          response: {
            type: "string",
            description: "Matched APDU response (hex).",
          },
        },
        required: ["response"],
      },
      Health: {
        type: "object",
        properties: {
          status: { type: "string", example: "ok" },
          sessions: { type: "integer" },
        },
        required: ["status", "sessions"],
      },
    },
    responses: {
      Unauthorized: {
        description: "Missing, invalid or expired bearer token.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      NotFound: {
        description: "Resource not found.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
  },
};
