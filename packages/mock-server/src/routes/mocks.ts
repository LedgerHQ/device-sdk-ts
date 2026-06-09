import { type Response, Router } from "express";

import { logger } from "../logger";
import {
  type AuthedRequest,
  bearerAuth,
  getSession,
} from "../middleware/bearerAuth";
import { type SessionStore } from "../store/SessionStore";

/** Session-scoped canned APDU response resource (ADR 002, Solution 3). */
export function mocksRouter(store: SessionStore): Router {
  const router = Router();
  router.use(bearerAuth(store));

  router.get("/mocks", (req: AuthedRequest, res: Response) => {
    res.json(store.listMocks(getSession(req)));
  });

  router.post("/mocks", (req: AuthedRequest, res: Response) => {
    const { prefix, response } = req.body ?? {};
    if (typeof prefix !== "string" || typeof response !== "string") {
      res.status(400).json({ error: "prefix and response are required" });
      return;
    }
    const mock = store.addMock(getSession(req), { prefix, response });
    logger.info(`Mock added: ${mock.prefix} -> ${mock.response}`);
    res.status(201).json(mock);
  });

  router.patch("/mocks/:id", (req: AuthedRequest, res: Response) => {
    const id = req.params["id"] ?? "";
    const mock = store.editMock(getSession(req), id, req.body ?? {});
    if (!mock) {
      res.status(404).json({ error: "Mock not found" });
      return;
    }
    res.json(mock);
  });

  router.delete("/mocks/:id", (req: AuthedRequest, res: Response) => {
    const id = req.params["id"] ?? "";
    if (!store.deleteMock(getSession(req), id)) {
      res.status(404).json({ error: "Mock not found" });
      return;
    }
    res.status(204).end();
  });

  router.delete("/mocks", (req: AuthedRequest, res: Response) => {
    store.clearMocks(getSession(req));
    logger.info("Mocks cleared");
    res.status(204).end();
  });

  return router;
}
