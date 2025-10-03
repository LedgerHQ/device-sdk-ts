export interface Downloader {
    download(url: string, destination: string): Promise<void>;
    isDownloaded(destination: string): Promise<boolean>;
}
