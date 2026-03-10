import {
  addERC7730Descriptor,
  CalInterceptor,
  ERC7730Client,
} from "@ledgerhq/cal-interceptor";
import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { readFileSync } from "fs";

/**
 * Service for setting up CAL interceptor with ERC7730 descriptors from files
 */
export class ERC7730InterceptorService {
  private interceptor: CalInterceptor | null = null;
  private readonly apiUrl: string;

  constructor(
    private readonly logger: LoggerPublisherService,
    apiUrl: string = process.env["ERC7730_API_URL"] ||
      "https://app.devicesdk.ledger-test.com",
  ) {
    this.apiUrl = apiUrl;
    if (process.env["ERC7730_API_URL"]) {
      this.logger.info(`Using custom ERC7730 API URL: ${this.apiUrl}`);
    }
  }

  /**
   * Process ERC7730 files and setup the interceptor
   * @param filePaths - Array of paths to ERC7730 JSON files
   * @returns The configured interceptor instance
   */
  async setupFromFiles(filePaths: string[]): Promise<CalInterceptor> {
    this.logger.info(
      `Setting up CAL interceptor with ${filePaths.length} ERC7730 file(s)`,
    );

    // Create interceptor
    this.interceptor = new CalInterceptor();
    const client = new ERC7730Client({ baseUrl: this.apiUrl });

    // Process each file using the helper
    for (const filePath of filePaths) {
      try {
        this.logger.info(`Processing: ${filePath}`);

        // Read and parse the file
        const fileContent = readFileSync(filePath, "utf-8");
        const descriptor = JSON.parse(fileContent);

        this.logger.debug(`Generating CAL descriptors for ${filePath}`);
        const result = await addERC7730Descriptor({
          descriptor,
          interceptor: this.interceptor,
          client,
          autoStart: true,
        });

        result.keys.forEach((key: unknown) => {
          this.logger.debug(`Stored descriptor for ${key}`);
        });
      } catch (error) {
        this.logger.error(`Failed to process ${filePath}`, {
          data: { error },
        });
        throw error;
      }
    }

    const descriptorCount = this.interceptor.getStoredDescriptorCount();
    this.logger.info(
      `Interceptor active with ${descriptorCount} descriptor(s)`,
    );

    return this.interceptor;
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
