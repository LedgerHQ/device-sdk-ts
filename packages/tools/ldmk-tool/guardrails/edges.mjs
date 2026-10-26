// [deps] The allowed edges between groups: which group may depend on which, and how.
//   "any"  = dependencies, peerDependencies or devDependencies
//   "peer" = peerDependencies (and devDependencies, for the local copy)
//   "dev"  = devDependencies only
// A missing entry means the edge is forbidden. `only` restricts an edge to some packages.
export const EDGES = {
  core: { tooling: "dev", config: "dev" },
  signerSupport: {
    core: "peer",
    signerSupport: "any",
    tooling: "dev",
    config: "dev",
  },
  signerKit: {
    core: "peer",
    signerSupport: "any",
    tooling: "dev",
    config: "dev",
  },
  transport: {
    core: "peer",
    testInfra: { kind: "any", only: ["packages/mockserver-client"] },
    tooling: "dev",
    config: "dev",
  },
  trustedApp: {
    core: "peer",
    signerSupport: "any",
    tooling: "dev",
    config: "dev",
  },
  testInfra: { core: "peer", testInfra: "any", tooling: "dev", config: "dev" },
  devtools: {
    core: "peer",
    testInfra: "any",
    devtools: "any",
    tooling: "dev",
    config: "dev",
  },
  ui: { core: "peer", tooling: "dev", config: "dev" },
  tooling: {
    core: "peer",
    signerSupport: "any",
    signerKit: "peer",
    transport: "any",
    testInfra: "any",
    devtools: "any",
    tooling: "any",
    config: "dev",
  },
  config: { config: "any" },
  app: {
    core: "any",
    signerSupport: "any",
    signerKit: "any",
    transport: "any",
    trustedApp: "any",
    testInfra: "any",
    devtools: "any",
    ui: "any",
    tooling: "any",
    config: "any",
    app: "dev",
  },
};

const KINDS = {
  any: ["dependencies", "peerDependencies", "devDependencies"],
  peer: ["peerDependencies", "devDependencies"],
  dev: ["devDependencies"],
};

// The dependency kinds allowed from one group to a package of another group,
// or an empty list when the edge is forbidden.
export function allowedKinds(fromGroup, toGroup, toDir) {
  const edge = EDGES[fromGroup]?.[toGroup];
  if (!edge) return [];
  if (typeof edge === "string") return KINDS[edge];
  if (edge.only && !edge.only.includes(toDir)) return [];
  return KINDS[edge.kind];
}
