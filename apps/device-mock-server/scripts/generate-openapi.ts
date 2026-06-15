import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { stringify } from "yaml";

import { buildOpenApiSpec } from "../src/internal/server/openapi/spec";

const outFile = fileURLToPath(new URL("../openapi.yaml", import.meta.url));

const spec = buildOpenApiSpec();
writeFileSync(outFile, stringify(spec), "utf8");

console.log(`OpenAPI spec written to ${outFile}`);
