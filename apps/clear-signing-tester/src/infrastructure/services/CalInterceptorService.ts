import {
  addERC7730Descriptor,
  CalInterceptor,
  ERC7730Client,
  setupInterceptorWithCertificates,
} from "@ledgerhq/cal-interceptor";
import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { readFileSync } from "fs";

/** The deployed sample app, whose API is the signer unless ERC7730_API_URL names another. */
const DEFAULT_SIGNER_URL = "https://app.devicesdk.ledger-test.com";

/**
 * The signer's `/api/signer-info` `resigningProxyVersion` this tester needs:
 * an older proxy re-signs descriptors the device checks under unreplaced keys,
 * and leaves POST ones prod-signed.
 */
const REQUIRED_RESIGNING_PROXY_VERSION = 2;

/**
 * The signer check runs before any emulator is acquired, so no scenario
 * timeout covers it: a stalled signer must not hold the run up.
 */
const SIGNER_CHECK_TIMEOUT_MS = 15_000;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const parseResigningProxyVersion = (text: string): number | undefined => {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return undefined;
  }
  return typeof body === "object" &&
    body !== null &&
    "resigningProxyVersion" in body &&
    typeof body.resigningProxyVersion === "number"
    ? body.resigningProxyVersion
    : undefined;
};

/**
 * Serves test-mode CAL for the whole process, through the sample app's signer.
 *
 * CAL's certificates certify the prod keys on every branch, while its `test`
 * signatures are made with the staging key. The signer bridges the two: it
 * serves certificates for the staging key, signed by Speculos's test root, and
 * re-signs the metadata-service descriptors that only carry a prod signature.
 */
export class CalInterceptorService {
  private interceptor: CalInterceptor | null = null;

  constructor(
    private readonly logger: LoggerPublisherService,
    private readonly signerUrl: string = process.env["ERC7730_API_URL"] ||
      DEFAULT_SIGNER_URL,
  ) {}

  /**
   * Check the signer, load its certificates, then inject the given ERC7730
   * descriptors.
   *
   * The signer and its certificates come first and are required: without them
   * every case would fail on the device, one emulator at a time, instead of
   * the run failing here once.
   *
   * @param erc7730Files - Paths to ERC7730 JSON files; may be empty
   * @throws If the signer is unreachable or too old, the certificates cannot
   * be loaded, or a descriptor cannot be processed
   */
  async start(erc7730Files: readonly string[]): Promise<void> {
    this.logger.info(`Starting the CAL interceptor, signer: ${this.signerUrl}`);

    await this.checkSignerVersion();

    const interceptor = new CalInterceptor({
      dynamicDescriptorProxyBaseUrl: this.signerUrl,
    });
    const client = new ERC7730Client({ baseUrl: this.signerUrl });

    // Fetches the certificates before patching fetch, so a failure here leaves
    // nothing to stop.
    try {
      await setupInterceptorWithCertificates(interceptor, client);
    } catch (error) {
      throw new Error(
        `Could not load the CAL test certificates from ${this.signerUrl}: ` +
          `${errorMessage(error)}. ` +
          `Test mode needs the sample app's signer: set ERC7730_API_URL to one that runs.`,
      );
    }
    this.interceptor = interceptor;

    const certificateCount = Object.keys(
      interceptor.getStoredCertificates(),
    ).length;
    if (certificateCount === 0) {
      this.stop();
      throw new Error(
        `The signer at ${this.signerUrl} returned no CAL test certificates.`,
      );
    }
    this.logger.info(`Loaded ${certificateCount} CAL test certificate(s)`);

    for (const filePath of erc7730Files) {
      try {
        this.logger.info(`Processing: ${filePath}`);
        // Parsed here so a malformed file is reported as such, not by the signer.
        const descriptor = JSON.parse(
          readFileSync(filePath, "utf-8"),
        ) as object;
        const result = await addERC7730Descriptor({
          descriptor,
          interceptor,
          client,
          autoStart: false,
        });
        result.keys.forEach((key) => {
          this.logger.debug(`Stored descriptor for ${key}`);
        });
      } catch (error) {
        this.logger.error(`Failed to process ${filePath}`, {
          data: { error },
        });
        this.stop();
        throw error;
      }
    }

    if (erc7730Files.length > 0) {
      this.logger.info(
        `Interceptor active with ${interceptor.getStoredDescriptorCount()} descriptor(s)`,
      );
    }
  }

  /**
   * Refuse a signer whose re-signing proxy is older than this tester needs.
   * The deployed sample app can lag behind the checkout, and an old proxy
   * fails cases on the device rather than here.
   *
   * @throws If the signer is unreachable or stalls, or is too old
   */
  private async checkSignerVersion(): Promise<void> {
    const url = `${this.signerUrl}/api/signer-info`;
    let response: Response;
    let text = "";
    try {
      // The signal also bounds reading the body, so it is read here.
      response = await fetch(url, {
        signal: AbortSignal.timeout(SIGNER_CHECK_TIMEOUT_MS),
      });
      if (response.ok) text = await response.text();
    } catch (error) {
      throw new Error(
        `Could not reach the CAL signer at ${this.signerUrl}: ${errorMessage(error)}. ` +
          `Test mode needs the sample app's signer: set ERC7730_API_URL to one that runs.`,
      );
    }

    // A signer older than /api/signer-info answers 404.
    if (!response.ok && response.status !== 404) {
      throw new Error(
        `The CAL signer at ${this.signerUrl} answered GET /api/signer-info ` +
          `with HTTP ${response.status}.`,
      );
    }
    const version = response.ok ? parseResigningProxyVersion(text) : undefined;
    if (version === undefined || version < REQUIRED_RESIGNING_PROXY_VERSION) {
      throw new Error(
        `The CAL signer at ${this.signerUrl} is too old for this tester: its ` +
          `re-signing proxy is version ${version ?? 1}, and test mode needs ` +
          `${REQUIRED_RESIGNING_PROXY_VERSION}. Run one from this checkout with ` +
          "`pnpm sample flask-dev`, and set ERC7730_API_URL=http://127.0.0.1:5328.",
      );
    }
  }

  /**
   * Stop the interceptor
   */
  stop(): void {
    if (this.interceptor && this.interceptor.isActive()) {
      this.interceptor.stop();
      this.logger.info("CAL interceptor stopped");
    }
  }
}
