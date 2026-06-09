import { type Response, Router } from "express";

import { matchApdu } from "../apdu/matcher";
import { UNKNOWN_APDU_RESPONSE } from "../defaults";
import { logger } from "../logger";
import {
  type AuthedRequest,
  bearerAuth,
  getSession,
} from "../middleware/bearerAuth";
import { type SessionStore } from "../store/SessionStore";

/**
 * Device resource routes: discovery, lifecycle, connection state and APDU
 * simulation. All scoped to the bearer-token session.
 */
export function devicesRouter(store: SessionStore): Router {
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
      const device = store.setConnected(getSession(req), id, false);
      if (!device) {
        res.status(404).json({ error: "Device not found" });
        return;
      }
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
  router.post("/devices/:id/apdu", (req: AuthedRequest, res: Response) => {
    const id = req.params["id"] ?? "";
    const session = getSession(req);
    const device = store.getDevice(session, id);
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return;
    }
    const apdu = String(req.body?.apdu ?? "");
    const response = matchApdu(apdu, store.listMocks(session));
    if (response === UNKNOWN_APDU_RESPONSE) {
      logger.warn(`APDU [${id}] ${apdu} -> ${response} (no matching mock)`);
    } else {
      logger.info(`APDU [${id}] ${apdu} -> ${response}`);
    }
    res.json({ response });
  });

  return router;
}
