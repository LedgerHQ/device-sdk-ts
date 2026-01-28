/**
 * Max chunk size for upload: APDU max payload (255) - 4 bytes for offset
 */
export const UPLOAD_MAX_CHUNK_SIZE = 251;

/**
 * Max chunk size for download: APDU response max (240) - 2 bytes for status
 */
export const DOWNLOAD_MAX_CHUNK_SIZE = 238;

/**
 * Represents a chunk of data to upload with its offset.
 */
export type UploadChunk = {
  readonly offset: number;
  readonly data: Uint8Array;
};

/**
 * Splits image data into chunks for upload.
 *
 * @param imageData - The full image data buffer
 * @returns Array of chunks with their offsets
 */
export function splitIntoUploadChunks(imageData: Uint8Array): UploadChunk[] {
  const chunks: UploadChunk[] = [];
  const nbChunks = Math.ceil(imageData.length / UPLOAD_MAX_CHUNK_SIZE);
  for (let i = 0; i < nbChunks; i++) {
    const offset = i * UPLOAD_MAX_CHUNK_SIZE;
    const chunkSize = Math.min(
      UPLOAD_MAX_CHUNK_SIZE,
      imageData.length - offset,
    );
    chunks.push({
      offset,
      data: imageData.slice(offset, offset + chunkSize),
    });
  }

  return chunks;
}

/**
 * Computes the length of the next chunk to download.
 *
 * @param currentOffset - Current position in the buffer
 * @param totalSize - Total size of the image to download
 * @returns The length of the next chunk to fetch
 */
export function getNextDownloadChunkLength(
  currentOffset: number,
  totalSize: number,
): number {
  const remaining = totalSize - currentOffset;
  return Math.min(DOWNLOAD_MAX_CHUNK_SIZE, remaining);
}
