import { inject, injectable } from "inversify";
import { EitherAsync } from "purify-ts";

import { type SpeculosCatalogueDataSource } from "@internal/speculos/data/SpeculosCatalogueDataSource";
import { speculosTypes } from "@internal/speculos/di/speculosTypes";
import {
  SpeculosError,
  type SpeculosOperatorConfig,
} from "@internal/speculos/model/SpeculosModels";

/** Budget for Speculinho to send the whole catalogue (~700 KB). */
const CATALOGUE_TIMEOUT_MS = 15_000;

interface Catalogue {
  readonly devices: Record<
    string,
    { readonly firmware: Record<string, Record<string, string[]>> }
  >;
}

/**
 * `fetch`-based {@link SpeculosCatalogueDataSource}. The catalogue is fetched
 * once, on first use, and kept for the server's lifetime: a failed fetch is
 * retried by the next lookup, and concurrent first lookups share one request.
 */
@injectable()
export class HttpSpeculosCatalogueDataSource
  implements SpeculosCatalogueDataSource
{
  private readonly url: string;
  private request?: Promise<Catalogue>;

  constructor(
    @inject(speculosTypes.OperatorConfig) config: SpeculosOperatorConfig,
  ) {
    this.url = `${config.baseUrl.replace(/\/+$/, "")}/catalogue`;
  }

  firmwareVersions(device: string): EitherAsync<SpeculosError, string[]> {
    return this.catalogue().map((catalogue) =>
      Object.keys(catalogue.devices[device]?.firmware ?? {}),
    );
  }

  appVersions(
    device: string,
    osVersion: string,
  ): EitherAsync<SpeculosError, Record<string, string[]>> {
    return this.catalogue().map(
      (catalogue) => catalogue.devices[device]?.firmware[osVersion] ?? {},
    );
  }

  private catalogue(): EitherAsync<SpeculosError, Catalogue> {
    return EitherAsync(async ({ throwE }) => {
      this.request ??= this.fetchCatalogue();
      try {
        return await this.request;
      } catch (error) {
        this.request = undefined;
        return throwE(
          error instanceof SpeculosError
            ? error
            : new SpeculosError(String(error)),
        );
      }
    });
  }

  private async fetchCatalogue(): Promise<Catalogue> {
    let res: Response;
    try {
      res = await fetch(this.url, {
        signal: AbortSignal.timeout(CATALOGUE_TIMEOUT_MS),
      });
    } catch (error) {
      throw new SpeculosError(`catalogue request failed: ${String(error)}`);
    }
    if (!res.ok) {
      throw new SpeculosError(`catalogue failed (${res.status})`);
    }
    return (await res.json()) as Catalogue;
  }
}
