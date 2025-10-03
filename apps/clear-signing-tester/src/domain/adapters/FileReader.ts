export interface FileReader {
    readFileSync(filePath: string): string;
    parseJson<T>(content: string): T;
}
