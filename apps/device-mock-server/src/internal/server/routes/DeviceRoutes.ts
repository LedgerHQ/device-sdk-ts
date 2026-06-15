import { type Response, Router } from "express";
import { inject, injectable, optional } from "inversify";

import { apduTypes } from "@internal/apdu/di/apduTypes";
import { type ApduResolverService } from "@internal/apdu/service/ApduResolverService";
import { logger } from "@internal/logger/logger";
import {
  type AuthedRequest,
  bearerAuth,
  getSession,
} from "@internal/server/middleware/bearerAuth";
import { decodeMockConfig } from "@internal/server/validation/requests";
import { type SessionRepository } from "@internal/session/data/SessionRepository";
import { sessionTypes } from "@internal/session/di/sessionTypes";
import { type SpeculosOperatorDataSource } from "@internal/speculos/data/SpeculosOperatorDataSource";
import { speculosTypes } from "@internal/speculos/di/speculosTypes";

/**
 * Device resource routes: discovery, lifecycle, connection state, APDU
 * simulation, per-device mocks and Speculos control.
 */
@injectable()
export class DeviceRoutes {
  constructor(
    @inject(sessionTypes.Repository)
    private readonly repository: SessionRepository,
    @inject(apduTypes.Resolver)
    private readonly resolver: ApduResolverService,
    @optional()
    @inject(speculosTypes.OperatorDataSource)
    private readonly operator?: SpeculosOperatorDataSource,
  ) {}

  build(): Router {
    const router = Router();
    router.use(bearerAuth(this.repository));

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
     *               items: { $ref: '#/components/schemas/Device' }
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *   post:
     *     tags: [Devices]
     *     summary: Attach a device
     *     requestBody:
     *       content:
     *         application/json:
     *           schema: { $ref: '#/components/schemas/DeviceConfig' }
     *     responses:
     *       201:
     *         description: Device created.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/Device' }
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     */
    router.get("/devices", (req: AuthedRequest, res: Response) => {
      res.json(this.repository.listDevices(getSession(req)));
    });

    router.post("/devices", (req: AuthedRequest, res: Response) => {
      const device = this.repository.addDevice(getSession(req), req.body ?? {});
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
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       404:
     *         $ref: '#/components/responses/NotFound'
     *   patch:
     *     tags: [Devices]
     *     summary: Edit a device
     *     parameters:
     *       - { name: id, in: path, required: true, schema: { type: string } }
     *     responses:
     *       200: { description: The updated device. }
     *       404:
     *         $ref: '#/components/responses/NotFound'
     *   delete:
     *     tags: [Devices]
     *     summary: Remove a device
     *     parameters:
     *       - { name: id, in: path, required: true, schema: { type: string } }
     *     responses:
     *       204: { description: Device removed. }
     *       404:
     *         $ref: '#/components/responses/NotFound'
     */
    router.get("/devices/:id", (req: AuthedRequest, res: Response) => {
      const device = this.repository
        .findDevice(getSession(req), req.params["id"] ?? "")
        .extract();
      if (!device) return this.notFound(res, "Device not found");
      res.json(device);
    });

    router.patch("/devices/:id", (req: AuthedRequest, res: Response) => {
      const device = this.repository
        .editDevice(getSession(req), req.params["id"] ?? "", req.body ?? {})
        .extract();
      if (!device) return this.notFound(res, "Device not found");
      res.json(device);
    });

    router.delete("/devices/:id", (req: AuthedRequest, res: Response) => {
      const { removed, proxy } = this.repository.deleteDevice(
        getSession(req),
        req.params["id"] ?? "",
      );
      if (!removed) return this.notFound(res, "Device not found");
      proxy.ifJust((p) => void this.operator?.release(p.runId).run());
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
     *       200: { description: Connection state. }
     *       404:
     *         $ref: '#/components/responses/NotFound'
     */
    router.post("/devices/:id/connect", (req: AuthedRequest, res: Response) => {
      const id = req.params["id"] ?? "";
      const device = this.repository
        .setConnected(getSession(req), id, true)
        .extract();
      if (!device) return this.notFound(res, "Device not found");
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
     *       200: { description: Connection state. }
     *       404:
     *         $ref: '#/components/responses/NotFound'
     */
    router.post(
      "/devices/:id/disconnect",
      (req: AuthedRequest, res: Response) => {
        const id = req.params["id"] ?? "";
        const session = getSession(req);
        const device = this.repository
          .setConnected(session, id, false)
          .extract();
        if (!device) return this.notFound(res, "Device not found");
        this.repository
          .deleteProxy(session, id)
          .ifJust((p) => void this.operator?.release(p.runId).run());
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
     *     parameters:
     *       - { name: id, in: path, required: true, schema: { type: string } }
     *     requestBody:
     *       content:
     *         application/json:
     *           schema: { $ref: '#/components/schemas/ApduRequest' }
     *     responses:
     *       200:
     *         description: APDU response.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ApduResponse' }
     *       404:
     *         $ref: '#/components/responses/NotFound'
     */
    router.post(
      "/devices/:id/apdu",
      async (req: AuthedRequest, res: Response) => {
        const id = req.params["id"] ?? "";
        const session = getSession(req);
        const device = this.repository.findDevice(session, id).extract();
        if (!device) return this.notFound(res, "Device not found");
        const apdu = String((req.body as { apdu?: unknown })?.apdu ?? "");
        try {
          const response = await this.resolver.resolve(session, device, apdu);
          res.json({ response });
        } catch (error) {
          logger.error(`APDU [${id}] ${apdu} failed: ${String(error)}`);
          res.status(500).json({ error: "APDU resolution failed" });
        }
      },
    );

    // --- Device-scoped mocks ------------------------------------------------

    /**
     * @openapi
     * /devices/{id}/mocks:
     *   get:
     *     tags: [Mocks]
     *     summary: List a device's mocks
     *     parameters:
     *       - { name: id, in: path, required: true, schema: { type: string } }
     *     responses:
     *       200: { description: Mocks owned by the device. }
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
     *       404:
     *         $ref: '#/components/responses/NotFound'
     *   delete:
     *     tags: [Mocks]
     *     summary: Clear a device's mocks
     *     parameters:
     *       - { name: id, in: path, required: true, schema: { type: string } }
     *     responses:
     *       204: { description: Mocks cleared. }
     *       404:
     *         $ref: '#/components/responses/NotFound'
     */
    router.get("/devices/:id/mocks", (req: AuthedRequest, res: Response) => {
      const mocks = this.repository
        .listMocks(getSession(req), req.params["id"] ?? "")
        .extract();
      if (!mocks) return this.notFound(res, "Device not found");
      res.json(mocks);
    });

    router.post("/devices/:id/mocks", (req: AuthedRequest, res: Response) => {
      const id = req.params["id"] ?? "";
      decodeMockConfig(req.body).caseOf({
        Left: (error) => res.status(400).json({ error }),
        Right: (config) => {
          const mock = this.repository
            .addMock(getSession(req), id, config)
            .extract();
          if (!mock) return this.notFound(res, "Device not found");
          logger.info(
            `Mock added [${id}]: ${mock.prefix} -> ${mock.responses.join(",")}`,
          );
          return res.status(201).json(mock);
        },
      });
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
     *     responses:
     *       200: { description: The updated mock. }
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
     *       404:
     *         $ref: '#/components/responses/NotFound'
     */
    router.patch(
      "/devices/:id/mocks/:mockId",
      (req: AuthedRequest, res: Response) => {
        const mock = this.repository
          .editMock(
            getSession(req),
            req.params["id"] ?? "",
            req.params["mockId"] ?? "",
            req.body ?? {},
          )
          .extract();
        if (!mock) return this.notFound(res, "Mock not found");
        res.json(mock);
      },
    );

    router.delete(
      "/devices/:id/mocks/:mockId",
      (req: AuthedRequest, res: Response) => {
        const removed = this.repository.deleteMock(
          getSession(req),
          req.params["id"] ?? "",
          req.params["mockId"] ?? "",
        );
        if (!removed) return this.notFound(res, "Mock not found");
        res.status(204).end();
      },
    );

    router.delete("/devices/:id/mocks", (req: AuthedRequest, res: Response) => {
      const id = req.params["id"] ?? "";
      const session = getSession(req);
      if (this.repository.findDevice(session, id).isNothing()) {
        return this.notFound(res, "Device not found");
      }
      this.repository.clearMocks(session, id);
      logger.info(`Mocks cleared [${id}]`);
      res.status(204).end();
    });

    // --- Speculos control (device-linked emulator) --------------------------

    /**
     * @openapi
     * /devices/{id}/speculos:
     *   get:
     *     tags: [Speculos]
     *     summary: Get the device's live Speculos instance
     *     parameters:
     *       - { name: id, in: path, required: true, schema: { type: string } }
     *     responses:
     *       200: { description: The active Speculos instance. }
     *       404:
     *         $ref: '#/components/responses/NotFound'
     *       409: { description: No active Speculos instance for the device. }
     */
    router.get("/devices/:id/speculos", (req: AuthedRequest, res: Response) => {
      const resolved = this.resolveSpeculos(req, res);
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
     *     responses:
     *       200: { description: The emulator response. }
     *       409: { description: No active Speculos instance for the device. }
     */
    router.all(
      "/devices/:id/speculos/*",
      async (req: AuthedRequest, res: Response) => {
        const resolved = this.resolveSpeculos(req, res);
        if (!resolved || !this.operator) {
          if (resolved && !this.operator) {
            res.status(502).json({ error: "Speculos proxy unavailable" });
          }
          return;
        }
        const hasBody = req.method !== "GET" && req.method !== "HEAD";
        const result = await this.operator
          .proxyRequest(resolved.proxy.speculosUrl, {
            method: req.method,
            path: req.params[0] ?? "",
            query: req.originalUrl.includes("?")
              ? `?${req.originalUrl.split("?")[1]}`
              : "",
            body: req.body,
            hasBody,
          })
          .run();
        result.caseOf({
          Left: (error) => {
            logger.error(
              `Speculos proxy [${req.params["id"]}] ${req.method} failed: ${error.message}`,
            );
            res.status(502).json({ error: "Speculos proxy failed" });
          },
          Right: (response) => {
            if (response.contentType) {
              res.set("Content-Type", response.contentType);
            }
            res.status(response.status).send(response.body);
          },
        });
      },
    );

    return router;
  }

  private notFound(res: Response, message: string): void {
    res.status(404).json({ error: message });
  }

  /** Resolve the device + its active Speculos proxy, or write 404/409. */
  private resolveSpeculos(req: AuthedRequest, res: Response) {
    const id = req.params["id"] ?? "";
    const session = getSession(req);
    const device = this.repository.findDevice(session, id).extract();
    if (!device) {
      res.status(404).json({ error: "Device not found" });
      return undefined;
    }
    const proxy = this.repository.findProxy(session, id).extract();
    if (!proxy) {
      res
        .status(409)
        .json({ error: "No active Speculos instance for this device" });
      return undefined;
    }
    return { device, proxy };
  }
}
