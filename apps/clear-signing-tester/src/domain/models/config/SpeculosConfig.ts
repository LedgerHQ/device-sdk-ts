export interface SpeculosConfig {
    url: string;
    port: number;
    device: "stax" | "nanox" | "nanos" | "nanos+" | "flex" | "apex";
    os?: string;
    version?: string;
}
