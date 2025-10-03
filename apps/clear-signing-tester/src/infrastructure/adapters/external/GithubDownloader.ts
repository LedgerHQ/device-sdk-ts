import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import axios, { AxiosError } from "axios";
import fsSync from "fs";
import fs from "fs/promises";
import { inject, injectable } from "inversify";
import * as path from "path";
import { Readable } from "stream";

import { TYPES } from "@root/src/di/types";
import { Downloader } from "@root/src/domain/adapters/Downloader";

@injectable()
export class GithubDownloader implements Downloader {
    private readonly logger: LoggerPublisherService;

    constructor(
        @inject(TYPES.LoggerPublisherServiceFactory)
        private readonly loggerFactory: (tag: string) => LoggerPublisherService,
    ) {
        this.logger = this.loggerFactory("github-downloader");
    }

    isDownloaded(destination: string): boolean {
        return fsSync.existsSync(destination);
    }

    async download(url: string, destination: string): Promise<void> {
        this.logger.debug(`Downloading file from ${url} to ${destination}`);

        try {
            const { data: blob } = await axios<Readable>({
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
