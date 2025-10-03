import { Downloader } from "@root/src/domain/adapters/Downloader";
import axios, { AxiosError } from "axios";
import fs from "fs/promises";
import fsSync from "fs";
import * as path from "path";
import { inject, injectable } from "inversify";
import { TYPES } from "@root/src/di/types";
import { LoggerPublisherService } from "@ledgerhq/device-management-kit";

@injectable()
export class GithubDownloader implements Downloader {
    private readonly logger: LoggerPublisherService;

    constructor(
        @inject(TYPES.LoggerPublisherServiceFactory)
        private readonly loggerFactory: (tag: string) => LoggerPublisherService,
    ) {
        this.logger = this.loggerFactory("github-downloader");
    }

    async isDownloaded(destination: string): Promise<boolean> {
        return fsSync.existsSync(destination);
    }

    async download(url: string, destination: string): Promise<void> {
        this.logger.debug(`Downloading file from ${url} to ${destination}`);

        try {
            const { data: blob } = await axios({
                url,
                method: "GET",
                responseType: "stream",
                headers: {
                    Authorization: `Bearer ${process.env["GH_TOKEN"]}`,
                },
            });

            // Ensure directory exists
            await fs.mkdir(path.dirname(destination), { recursive: true });

            // Write app file
            await fs.writeFile(destination, blob, "binary");

            this.logger.info(`File downloaded successfully to ${destination}`);
        } catch (error) {
            if (error instanceof AxiosError) {
                throw new Error(
                    `${error.status}: Failed to download file from ${url}`,
                );
            }
            throw error;
        }
    }
}
