import { type Response, Router } from "express";

import { logger } from "../logger";
import {
  type AuthedRequest,
  bearerAuth,
  getSession,
} from "../middleware/bearerAuth";
import { type SessionStore } from "../store/SessionStore";

interface MockEntry {
  prefix?: unknown;
  response?: unknown;
  responses?: unknown;
}

function isValidMock(entry: MockEntry): boolean {
  if (typeof entry?.prefix !== "string") return false;
  const hasResponse = typeof entry.response === "string";
  const hasResponses =
    Array.isArray(entry.responses) &&
    entry.responses.length > 0 &&
    entry.responses.every((value) => typeof value === "string");
  return hasResponse || hasResponses;
}

/**
 * Session-scoped import/export of the devices and mocks snapshot, so complex
 * scenarios can be saved and restored.
 */
export function transferRouter(store: SessionStore): Router {
  const router = Router();
  router.use(bearerAuth(store));

  /**
   * @openapi
   * /export:
   *   get:
   *     tags: [Transfer]
   *     summary: Export the session's devices and mocks
   *     responses:
   *       200:
   *         description: A portable snapshot of the session.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SessionExport'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
  router.get("/export", (req: AuthedRequest, res: Response) => {
    res.json(store.exportSession(getSession(req)));
  });

  /**
   * @openapi
   * /import:
   *   post:
   *     tags: [Transfer]
   *     summary: Replace the session's devices and mocks with a snapshot
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/SessionExport'
   *     responses:
   *       200:
   *         description: The resulting (normalized) snapshot.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SessionExport'
   *       400:
   *         description: Malformed snapshot.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
  router.post("/import", (req: AuthedRequest, res: Response) => {
    const { devices, mocks } = req.body ?? {};
    if (!Array.isArray(devices) || !Array.isArray(mocks)) {
      res.status(400).json({ error: "devices and mocks arrays are required" });
      return;
    }
    if (!mocks.every(isValidMock)) {
      res.status(400).json({
        error: "each mock requires a prefix and a response or responses",
      });
      return;
    }
    const result = store.importSession(getSession(req), { devices, mocks });
    logger.info(
      `Session imported: ${result.devices.length} device(s), ${result.mocks.length} mock(s)`,
    );
    res.json(result);
  });

  return router;
}
