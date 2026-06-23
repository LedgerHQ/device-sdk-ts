import { fileURLToPath } from "node:url";

import swaggerJSDoc from "swagger-jsdoc";

import { openapiDefinition } from "./definition";

const routesGlob = fileURLToPath(new URL("../routes/*.ts", import.meta.url));
const serverFile = fileURLToPath(
  new URL("../HttpAppFactory.ts", import.meta.url),
);

/**
 * Build the OpenAPI document by merging {@link openapiDefinition} with the
 * `@openapi` JSDoc annotations declared next to the Express handlers.
 */
export function buildOpenApiSpec(): object {
  return swaggerJSDoc({
    definition: openapiDefinition,
    apis: [routesGlob, serverFile],
  });
}
