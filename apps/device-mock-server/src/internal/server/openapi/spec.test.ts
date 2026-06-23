import { buildOpenApiSpec } from "@internal/server/openapi/spec";

/**
 * Guards the swagger-jsdoc wiring: the route glob and server-file reference must
 * keep resolving so the `@openapi` JSDoc blocks are actually picked up. A
 * regression here (e.g. a renamed/moved file) yields a spec with no paths.
 */
describe("buildOpenApiSpec", () => {
  const spec = buildOpenApiSpec() as {
    openapi?: string;
    paths?: Record<string, unknown>;
  };

  it("produces a versioned document", () => {
    expect(spec.openapi).toMatch(/^3\./);
  });

  it("collects the documented route paths from the JSDoc annotations", () => {
    const paths = Object.keys(spec.paths ?? {});
    // A representative slice across every route module + the health probe.
    expect(paths).toEqual(
      expect.arrayContaining([
        "/auth",
        "/health",
        "/sessions/current",
        "/devices",
        "/devices/{id}",
        "/devices/{id}/apdu",
        "/devices/{id}/mocks",
        "/devices/{id}/speculos",
        "/export",
        "/import",
      ]),
    );
  });
});
