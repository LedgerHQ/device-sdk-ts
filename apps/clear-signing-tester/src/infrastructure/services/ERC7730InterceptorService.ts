import {
  addERC7730Descriptor,
  CalInterceptor,
  ERC7730Client,
} from "@ledgerhq/cal-interceptor";
import { readFileSync } from "fs";

/**
 * Service for setting up CAL interceptor with ERC7730 descriptors from files
 */
export class ERC7730InterceptorService {
  private interceptor: CalInterceptor | null = null;
  private readonly apiUrl: string;

  constructor(apiUrl: string = "https://app.devicesdk.ledger-test.com") {
    this.apiUrl = apiUrl;
  }

  /**
   * Process ERC7730 files and setup the interceptor
   * @param filePaths - Array of paths to ERC7730 JSON files
   * @returns The configured interceptor instance
   */
  async setupFromFiles(filePaths: string[]): Promise<CalInterceptor> {
    console.log(
      `\n🔧 Setting up CAL interceptor with ${filePaths.length} ERC7730 file(s)...\n`,
    );

    // Create interceptor
    this.interceptor = new CalInterceptor();
    const client = new ERC7730Client({ baseUrl: this.apiUrl });

    // Process each file using the helper
    for (const filePath of filePaths) {
      try {
        console.log(`📄 Processing: ${filePath}`);

        // Read and parse the file
        const fileContent = readFileSync(filePath, "utf-8");
        const descriptor = JSON.parse(fileContent);

        // Use the helper to process and store the descriptor
        console.log(`   ⚙️  Generating CAL descriptors...`);
        const result = await addERC7730Descriptor({
          descriptor,
          interceptor: this.interceptor,
          client,
          autoStart: true,
        });

        result.keys.forEach((key: unknown) => {
          console.log(`   ✓ Stored descriptor for ${key}`);
        });
      } catch (error) {
        console.error(`   ❌ Failed to process ${filePath}:`, error);
        throw error;
      }
    }

    const descriptorCount = this.interceptor.getStoredDescriptorCount();
    console.log(
      `\n🚀 Interceptor active with ${descriptorCount} descriptor(s)\n`,
    );

    return this.interceptor;
  }

  /**
   * Stop the interceptor
   */
  stop(): void {
    if (this.interceptor && this.interceptor.isActive()) {
      this.interceptor.stop();
      console.log("CAL interceptor stopped");
    }
  }
}
