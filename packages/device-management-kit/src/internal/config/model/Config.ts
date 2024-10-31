// Domain scoped types

export type Config = {
  version: string;
  name: string;
};

/**
 * Checks if the provided object is a valid Config object.
 * @param obj - The object to be checked.
 * @returns A boolean indicating whether the object is a Config object.
 */
export function isConfig(obj: unknown): obj is Config {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "version" in obj &&
    "name" in obj &&
    typeof obj.version === "string" &&
    typeof obj.name === "string"
  );
}
