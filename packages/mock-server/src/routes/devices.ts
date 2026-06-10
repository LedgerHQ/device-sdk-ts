import { type Response, Router } from "express";

import { logger } from "../logger";
import {
  type AuthedRequest,
  bearerAuth,
  getSession,
} from "../middleware/bearerAuth";
import { type SpeculinhoClient } from "../speculos/SpeculinhoClient";
import { resolveApdu } from "../speculos/SpeculosProxy";
import { type SessionStore } from "../store/SessionStore";

/**
 * Device resource routes: discovery, lifecycle, connection state and APDU
 * simulation. All scoped to the bearer-token session.
 *
 * When a {@link SpeculinhoClient} is provided, an unmatched Open App APDU spins
 * up a real Speculos instance and the device proxies subsequent APDUs to it.
 */
export function devicesRouter(
  store: SessionStore,
  client?: SpeculinhoClient,
): Router {
  const router = Router();
  router.use(bearerAuth(store));

  /**
   * @openapi
   * /devices:
   *   get:
   *     tags: [Devices]
   *     summary: List devices
   *     responses:
   *       200:
   *         description: Devices owned by the session.
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Device'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *   post:
   *     tags: [Devices]
   *     summary: Attach a device
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/DeviceConfig'
   *     responses:
   *       201:
   *         description: Device created.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Device'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
  router.get("/devices", (req: AuthedRequest, res: Response) => {
    res.json(store.listDevices(getSession(req)));
  });

  router.post("/devices", (req: AuthedRequest, res: Response) => {
    const device = store.addDevice(getSession(req), req.body ?? {});
    res.status(201).json(device);
  });

  /**
   * @openapi
   * /devices/{id}:
   *   get:
   *     tags: [Devices]
   *     summary: Get a device
   *     parameters:
   *       - { name: id, in: path, required: true, schema: { type: string } }
   *     responses:
   *       200:
   *         description: The device.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Device'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *   patch:
   *     tags: [Devices]
   *     summary: Edit a device
   *     parameters:
   *       - { name: id, in: path, required: true, schema: { type: string } }
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/DeviceConfig'
   *     responses:
   *       200:
   *         description: The updated device.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Device'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *   delete:
   *     tags: [Devices]
   *     summary: Remove a device
   *     parameters:
   *       - { name: id, in: path, required: true, schema: { type: string } }
   *     responses:
   *       204:
   *         description: Device removed.
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  router.get("/devices/:id", (req: AuthedRequest, res: Response) => {
    const id = req.params["id"] ?? "";
    const device = store.getDevice(getSession(req), id);
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return;
    }
    res.json(device);
  });

  router.patch("/devices/:id", (req: AuthedRequest, res: Response) => {
    const id = req.params["id"] ?? "";
    const device = store.editDevice(getSession(req), id, req.body ?? {});
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return;
    }
    res.json(device);
  });

  router.delete("/devices/:id", (req: AuthedRequest, res: Response) => {
    const id = req.params["id"] ?? "";
    if (!store.deleteDevice(getSession(req), id)) {
      res.status(404).json({ error: "Device not found" });
      return;
    }
    res.status(204).end();
  });

  /**
   * @openapi
   * /devices/{id}/connect:
   *   post:
   *     tags: [Devices]
   *     summary: Connect a device
   *     parameters:
   *       - { name: id, in: path, required: true, schema: { type: string } }
   *     responses:
   *       200:
   *         description: Connection state.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ConnectionState'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  router.post("/devices/:id/connect", (req: AuthedRequest, res: Response) => {
    const id = req.params["id"] ?? "";
    const device = store.setConnected(getSession(req), id, true);
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return;
    }
    logger.info(`Device connected: ${device.name} (${id})`);
    res.json({ device, connected: true });
  });

  /**
   * @openapi
   * /devices/{id}/disconnect:
   *   post:
   *     tags: [Devices]
   *     summary: Disconnect a device
   *     parameters:
   *       - { name: id, in: path, required: true, schema: { type: string } }
   *     responses:
   *       200:
   *         description: Connection state.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ConnectionState'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  router.post(
    "/devices/:id/disconnect",
    (req: AuthedRequest, res: Response) => {
      const id = req.params["id"] ?? "";
      const session = getSession(req);
      const device = store.setConnected(session, id, false);
      if (!device) {
        res.status(404).json({ error: "Device not found" });
        return;
      }
      const proxy = store.deleteProxy(session, id);
      if (proxy && client) void client.release(proxy.runId);
      logger.info(`Device disconnected: ${device.name} (${id})`);
      res.json({ device, connected: false });
    },
  );

  /**
   * @openapi
   * /devices/{id}/apdu:
   *   post:
   *     tags: [Devices]
   *     summary: Send an APDU to a device
   *     description: Returns the response of the first matching mock, or `6d00`.
   *     parameters:
   *       - { name: id, in: path, required: true, schema: { type: string } }
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/ApduRequest'
   *     responses:
   *       200:
   *         description: APDU response.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApduResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  router.post(
    "/devices/:id/apdu",
    async (req: AuthedRequest, res: Response) => {
      const id = req.params["id"] ?? "";
      const session = getSession(req);
      const device = store.getDevice(session, id);
      if (!device) {
        res.status(404).json({ error: "Device not found" });
        return;
      }
      const apdu = String(req.body?.apdu ?? "");
      try {
        const response = await resolveApdu({
          store,
          record: session,
          device,
          apduHex: apdu,
          client,
        });
        res.json({ response });
      } catch (error) {
        logger.error(`APDU [${id}] ${apdu} failed: ${String(error)}`);
        res.status(500).json({ error: "APDU resolution failed" });
      }
    },
  );

  // --- Device-scoped mocks --------------------------------------------------

  /**
   * @openapi
   * /devices/{id}/mocks:
   *   get:
   *     tags: [Mocks]
   *     summary: List a device's mocks
   *     parameters:
   *       - { name: id, in: path, required: true, schema: { type: string } }
   *     responses:
   *       200:
   *         description: Mocks owned by the device.
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items: { $ref: '#/components/schemas/Mock' }
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *   post:
   *     tags: [Mocks]
   *     summary: Add a mock to a device
   *     parameters:
   *       - { name: id, in: path, required: true, schema: { type: string } }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/MockConfig' }
   *     responses:
   *       201: { description: Mock created. }
   *       400: { description: prefix and a response are required. }
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *   delete:
   *     tags: [Mocks]
   *     summary: Clear a device's mocks
   *     parameters:
   *       - { name: id, in: path, required: true, schema: { type: string } }
   *     responses:
   *       204: { description: Mocks cleared. }
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  router.get("/devices/:id/mocks", (req: AuthedRequest, res: Response) => {
    const id = req.params["id"] ?? "";
    const mocks = store.listMocks(getSession(req), id);
    if (!mocks) {
      res.status(404).json({ error: "Device not found" });
      return;
    }
    res.json(mocks);
  });

  router.post("/devices/:id/mocks", (req: AuthedRequest, res: Response) => {
    const id = req.params["id"] ?? "";
    const { prefix, response, responses } = req.body ?? {};
    const hasResponse = typeof response === "string";
    const hasResponses =
      Array.isArray(responses) &&
      responses.length > 0 &&
      responses.every((entry) => typeof entry === "string");
    if (typeof prefix !== "string" || (!hasResponse && !hasResponses)) {
      res.status(400).json({
        error:
          "prefix and a response or non-empty responses array are required",
      });
      return;
    }
    const mock = store.addMock(getSession(req), id, {
      prefix,
      response,
      responses,
    });
    if (!mock) {
      res.status(404).json({ error: "Device not found" });
      return;
    }
    logger.info(
      `Mock added [${id}]: ${mock.prefix} -> ${mock.responses.join(",")}`,
    );
    res.status(201).json(mock);
  });

  /**
   * @openapi
   * /devices/{id}/mocks/{mockId}:
   *   patch:
   *     tags: [Mocks]
   *     summary: Edit a device's mock
   *     parameters:
   *       - { name: id, in: path, required: true, schema: { type: string } }
   *       - { name: mockId, in: path, required: true, schema: { type: string } }
   *     requestBody:
   *       content:
   *         application/json:
   *           schema: { $ref: '#/components/schemas/MockConfig' }
   *     responses:
   *       200: { description: The updated mock. }
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *   delete:
   *     tags: [Mocks]
   *     summary: Remove a device's mock
   *     parameters:
   *       - { name: id, in: path, required: true, schema: { type: string } }
   *       - { name: mockId, in: path, required: true, schema: { type: string } }
   *     responses:
   *       204: { description: Mock removed. }
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  router.patch(
    "/devices/:id/mocks/:mockId",
    (req: AuthedRequest, res: Response) => {
      const id = req.params["id"] ?? "";
      const mockId = req.params["mockId"] ?? "";
      const mock = store.editMock(getSession(req), id, mockId, req.body ?? {});
      if (!mock) {
        res.status(404).json({ error: "Mock not found" });
        return;
      }
      res.json(mock);
    },
  );

  router.delete(
    "/devices/:id/mocks/:mockId",
    (req: AuthedRequest, res: Response) => {
      const id = req.params["id"] ?? "";
      const mockId = req.params["mockId"] ?? "";
      if (!store.deleteMock(getSession(req), id, mockId)) {
        res.status(404).json({ error: "Mock not found" });
        return;
      }
      res.status(204).end();
    },
  );

  router.delete("/devices/:id/mocks", (req: AuthedRequest, res: Response) => {
    const id = req.params["id"] ?? "";
    const session = getSession(req);
    if (!store.getDevice(session, id)) {
      res.status(404).json({ error: "Device not found" });
      return;
    }
    store.clearMocks(session, id);
    logger.info(`Mocks cleared [${id}]`);
    res.status(204).end();
  });

  // --- Speculos control (device-linked emulator) ----------------------------

  /**
   * Resolve the live Speculos instance backing a device, writing the
   * appropriate error response when the device or its proxy is missing.
   */
  const resolveSpeculos = (req: AuthedRequest, res: Response) => {
    const id = req.params["id"] ?? "";
    const session = getSession(req);
    const device = store.getDevice(session, id);
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return undefined;
    }
    const proxy = store.getProxy(session, id);
    if (!proxy) {
      res
        .status(409)
        .json({ error: "No active Speculos instance for this device" });
      return undefined;
    }
    return { device, proxy };
  };

  /**
   * @openapi
   * /devices/{id}/speculos:
   *   get:
   *     tags: [Speculos]
   *     summary: Get the device's live Speculos instance
   *     description: >-
   *       Returns the Speculinho run id, the emulator URL and the device model
   *       for the Speculos instance currently proxying the device's APDUs.
   *     parameters:
   *       - { name: id, in: path, required: true, schema: { type: string } }
   *     responses:
   *       200: { description: The active Speculos instance. }
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       409: { description: No active Speculos instance for the device. }
   */
  router.get("/devices/:id/speculos", (req: AuthedRequest, res: Response) => {
    const resolved = resolveSpeculos(req, res);
    if (!resolved) return;
    res.json({
      run_id: resolved.proxy.runId,
      speculos_url: resolved.proxy.speculosUrl,
      model: resolved.device.device_type,
    });
  });

  /**
   * @openapi
   * /devices/{id}/speculos/{path}:
   *   parameters:
   *     - { name: id, in: path, required: true, schema: { type: string } }
   *     - { name: path, in: path, required: true, schema: { type: string } }
   *   get:
   *     tags: [Speculos]
   *     summary: Proxy a request to the device's Speculos instance
   *     description: >-
   *       Transparent passthrough to the live emulator (any method). Used to
   *       drive the device — e.g. POST `/button/{key}` or `/finger` — without
   *       exposing the emulator URL directly.
   *     responses:
   *       200: { description: The emulator response. }
   *       409: { description: No active Speculos instance for the device. }
   */
  router.all(
    "/devices/:id/speculos/*",
    async (req: AuthedRequest, res: Response) => {
      const resolved = resolveSpeculos(req, res);
      if (!resolved) return;
      const subPath = req.params[0] ?? "";
      const base = resolved.proxy.speculosUrl.replace(/\/+$/, "");
      const query = req.originalUrl.includes("?")
        ? `?${req.originalUrl.split("?")[1]}`
        : "";
      const url = `${base}/${subPath}${query}`;
      const hasBody = req.method !== "GET" && req.method !== "HEAD";
      try {
        const upstream = await fetch(url, {
          method: req.method,
          headers: hasBody ? { "Content-Type": "application/json" } : undefined,
          body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
        });
        const body = await upstream.text();
        const contentType = upstream.headers.get("content-type");
        if (contentType) res.set("Content-Type", contentType);
        res.status(upstream.status).send(body);
      } catch (error) {
        logger.error(
          `Speculos proxy [${req.params["id"]}] ${req.method} ${subPath} failed: ${String(error)}`,
        );
        res.status(502).json({ error: "Speculos proxy failed" });
      }
    },
  );

  return router;
}
