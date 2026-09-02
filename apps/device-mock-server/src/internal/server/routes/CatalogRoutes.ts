import { type Response, Router } from "express";
import { inject, injectable } from "inversify";

import { catalogTypes } from "@internal/catalog/di/catalogTypes";
import { type AppCatalogService } from "@internal/catalog/service/AppCatalogService";
import {
  type AuthedRequest,
  bearerAuth,
} from "@internal/server/middleware/bearerAuth";
import { type SessionRepository } from "@internal/session/data/SessionRepository";
import { sessionTypes } from "@internal/session/di/sessionTypes";

/**
 * Read-only lookup of the apps a model/firmware pair really has, so a device can
 * be given app versions that exist rather than invented ones.
 */
@injectable()
export class CatalogRoutes {
  constructor(
    @inject(sessionTypes.Repository)
    private readonly repository: SessionRepository,
    @inject(catalogTypes.AppCatalogService)
    private readonly catalog: AppCatalogService,
  ) {}

  build(): Router {
    const router = Router();
    router.use(bearerAuth(this.repository));

    /**
     * @openapi
     * /catalog/apps:
     *   get:
     *     tags: [Catalog]
     *     summary: List the apps that exist for a device model and firmware
     *     description: |
     *       Proxies the Manager API's app list for the target id the model
     *       reports and the given firmware version. App versions are tied to a
     *       firmware version, and Speculos resolves an ELF at
     *       `/apps/{device}/{firmware}/{App}/app_{version}.elf`, so these are
     *       the versions a device on that firmware can actually open.
     *     parameters:
     *       - { name: device_type, in: query, required: true, schema: { type: string }, example: flex }
     *       - { name: firmware_version, in: query, required: true, schema: { type: string }, example: 1.6.1 }
     *     responses:
     *       200:
     *         description: The apps available for that model and firmware.
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items: { $ref: '#/components/schemas/DeviceApp' }
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       502:
     *         description: The Manager API could not be reached or knows nothing for this pair.
     */
    router.get("/catalog/apps", async (req: AuthedRequest, res: Response) => {
      const pair = this.readPair(req, res);
      if (!pair) return;
      const result = await this.catalog.list(
        pair.deviceType,
        pair.firmwareVersion,
      );
      result.caseOf({
        Left: (error) => res.status(502).json({ error }),
        Right: (apps) => res.json(apps),
      });
    });

    /**
     * @openapi
     * /catalog/firmware:
     *   get:
     *     tags: [Catalog]
     *     summary: Check that an OS version exists for a device model
     *     description: |
     *       Resolves the model's target id to a Manager API device version, then
     *       asks whether the named firmware was released for it. Speculos boots
     *       the OS by this exact name, so a version that never shipped leaves it
     *       with nothing to run.
     *     parameters:
     *       - { name: device_type, in: query, required: true, schema: { type: string }, example: flex }
     *       - { name: firmware_version, in: query, required: true, schema: { type: string }, example: 1.6.1 }
     *     responses:
     *       200:
     *         description: Whether that OS version exists.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 exists: { type: boolean }
     *                 model: { type: string, example: Flex }
     *               required: [exists, model]
     *       400:
     *         $ref: '#/components/responses/BadRequest'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     *       502:
     *         description: The Manager API could not be reached.
     */
    router.get(
      "/catalog/firmware",
      async (req: AuthedRequest, res: Response) => {
        const pair = this.readPair(req, res);
        if (!pair) return;
        const result = await this.catalog.checkFirmware(
          pair.deviceType,
          pair.firmwareVersion,
        );
        result.caseOf({
          Left: (error) => res.status(502).json({ error }),
          Right: (check) => res.json(check),
        });
      },
    );

    return router;
  }

  /** Read the model/firmware pair both routes take, or write a 400. */
  private readPair(
    req: AuthedRequest,
    res: Response,
  ): { deviceType: string; firmwareVersion: string } | undefined {
    const deviceType = String(req.query["device_type"] ?? "").trim();
    const firmwareVersion = String(req.query["firmware_version"] ?? "").trim();
    if (!deviceType || !firmwareVersion) {
      res
        .status(400)
        .json({ error: "device_type and firmware_version are required" });
      return undefined;
    }
    return { deviceType, firmwareVersion };
  }
}
