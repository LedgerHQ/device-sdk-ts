import { type Response, Router } from "express";

import { logger } from "../logger";
import {
  type AuthedRequest,
  bearerAuth,
  getSession,
} from "../middleware/bearerAuth";
import { type SessionStore } from "../store/SessionStore";

/** Session-scoped canned APDU response resource. */
export function mocksRouter(store: SessionStore): Router {
  const router = Router();
  router.use(bearerAuth(store));

  /**
   * @openapi
   * /mocks:
   *   get:
   *     tags: [Mocks]
   *     summary: List mocks
   *     responses:
   *       200:
   *         description: Mocks owned by the session.
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Mock'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *   post:
   *     tags: [Mocks]
   *     summary: Add a mock
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/MockConfig'
   *     responses:
   *       201:
   *         description: Mock created.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Mock'
   *       400:
   *         description: prefix and response are required.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *   delete:
   *     tags: [Mocks]
   *     summary: Clear all mocks
   *     responses:
   *       204:
   *         description: Mocks cleared.
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
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

  /**
   * @openapi
   * /mocks/{id}:
   *   patch:
   *     tags: [Mocks]
   *     summary: Edit a mock
   *     parameters:
   *       - { name: id, in: path, required: true, schema: { type: string } }
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/MockConfig'
   *     responses:
   *       200:
   *         description: The updated mock.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Mock'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *   delete:
   *     tags: [Mocks]
   *     summary: Remove a mock
   *     parameters:
   *       - { name: id, in: path, required: true, schema: { type: string } }
   *     responses:
   *       204:
   *         description: Mock removed.
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
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
