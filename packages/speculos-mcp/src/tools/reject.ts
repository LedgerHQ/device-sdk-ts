import { rejectFlow } from "../actions";
import type { ToolDeps } from "./helpers";
import { toolResponse } from "./helpers";

export function register(deps: ToolDeps): void {
  deps.server.registerTool(
    "reject",
    {
      description:
        "Reject the current transaction. DESTRUCTIVE — cancels the signing flow.",
    },
    async () => {
      const result = await rejectFlow(deps.client, () =>
        deps.session.getSigningState(),
      );
      return toolResponse(deps, { action: result.screen });
    },
  );
}
