import { type Request, type Response, Router } from "express";
import { inject, injectable, optional } from "inversify";

import { logger } from "@internal/logger/logger";
import { type SpeculosCatalogueDataSource } from "@internal/speculos/data/SpeculosCatalogueDataSource";
import { speculosTypes } from "@internal/speculos/di/speculosTypes";
import { type SpeculosError } from "@internal/speculos/model/SpeculosModels";
import { mapDeviceModel } from "@internal/speculos/util/openApp";

/**
 * GET /speculos/catalogue — what Speculos can boot, for clients choosing a
 * device's firmware and apps. Public: it exposes nothing session-scoped.
 */
@injectable()
export class CatalogueRoutes {
  constructor(
    @optional()
    @inject(speculosTypes.CatalogueDataSource)
    private readonly catalogue?: SpeculosCatalogueDataSource,
  ) {}

  build(): Router {
    const router = Router();

    /**
     * @openapi
     * /speculos/catalogue/{deviceType}:
     *   get:
     *     tags: [Speculos]
     *     summary: Firmware versions Speculos can boot on a model
     *     security: []
     *     parameters:
     *       - in: path
     *         name: deviceType
     *         required: true
     *         description: DMK DeviceModelId (`nanoX`, `stax`, ...).
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: Firmware versions, unordered.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 firmware:
     *                   type: array
     *                   items: { type: string }
     *       400:
     *         description: The catalogue does not cover this model.
     *       404:
     *         description: No Speculos operator is configured.
     *       502:
     *         description: The catalogue could not be read.
     */
    router.get(
      "/speculos/catalogue/:deviceType",
      async (req: Request, res: Response) => {
        const model = this.resolveModel(req, res);
        if (!this.catalogue || !model) return;
        const result = await this.catalogue.firmwareVersions(model).run();
        result.caseOf({
          Left: (error) => unavailable(res, error),
          Right: (firmware) => res.json({ firmware }),
        });
      },
    );

    /**
     * @openapi
     * /speculos/catalogue/{deviceType}/{firmwareVersion}:
     *   get:
     *     tags: [Speculos]
     *     summary: App versions Speculos can boot on a model and firmware
     *     description: >
     *       Speculinho's catalogue narrowed to one model and OS. An app whose
     *       version is missing here fails Open App with 6d00 once proxied.
     *     security: []
     *     parameters:
     *       - in: path
     *         name: deviceType
     *         required: true
     *         description: DMK DeviceModelId (`nanoX`, `stax`, ...).
     *         schema: { type: string }
     *       - in: path
     *         name: firmwareVersion
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: Versions keyed by app name; empty when Speculos has no build of this firmware.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 apps:
     *                   type: object
     *                   additionalProperties:
     *                     type: array
     *                     items: { type: string }
     *       400:
     *         description: The catalogue does not cover this model.
     *       404:
     *         description: No Speculos operator is configured.
     *       502:
     *         description: The catalogue could not be read.
     */
    router.get(
      "/speculos/catalogue/:deviceType/:firmwareVersion",
      async (req: Request, res: Response) => {
        const model = this.resolveModel(req, res);
        if (!this.catalogue || !model) return;
        const result = await this.catalogue
          .appVersions(model, req.params["firmwareVersion"] ?? "")
          .run();
        result.caseOf({
          Left: (error) => unavailable(res, error),
          Right: (apps) => res.json({ apps }),
        });
      },
    );

    return router;
  }
  /**
   * The Speculinho model a request names, or `undefined` once it has answered
   * the request itself.
   */
  private resolveModel(req: Request, res: Response): string | undefined {
    if (!this.catalogue) {
      res.status(404).json({ error: "No Speculos operator configured" });
      return undefined;
    }
    const deviceType = req.params["deviceType"] ?? "";
    const model = mapDeviceModel(deviceType);
    if (!model) {
      res
        .status(400)
        .json({ error: `The catalogue does not cover "${deviceType}"` });
      return undefined;
    }
    return model;
  }
}

const unavailable = (res: Response, error: SpeculosError) => {
  logger.warn(`Speculos catalogue unavailable: ${error.message}`);
  res.status(502).json({ error: error.message });
};
