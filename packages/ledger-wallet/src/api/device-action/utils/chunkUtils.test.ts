import {
  DOWNLOAD_MAX_CHUNK_SIZE,
  getNextDownloadChunkLength,
  splitIntoUploadChunks,
  UPLOAD_MAX_CHUNK_SIZE,
} from "./chunkUtils";

describe("chunkUtils", () => {
  describe("splitIntoUploadChunks", () => {
    it("should return single chunk for small data", () => {
      const imageData = new Uint8Array([1, 2, 3, 4, 5]);

      const chunks = splitIntoUploadChunks(imageData);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.offset).toBe(0);
      expect(chunks[0]!.data).toEqual(imageData);
    });

    it("should split data exceeding max chunk size into multiple chunks", () => {
      const imageData = new Uint8Array(500);
      for (let i = 0; i < 500; i++) imageData[i] = i % 256;

      const chunks = splitIntoUploadChunks(imageData);

      expect(chunks).toHaveLength(2);
      // First chunk
      expect(chunks[0]!.offset).toBe(0);
      expect(chunks[0]!.data.length).toBe(UPLOAD_MAX_CHUNK_SIZE);
      expect(chunks[0]!.data).toEqual(
        imageData.slice(0, UPLOAD_MAX_CHUNK_SIZE),
      );
      // Second chunk
      expect(chunks[1]!.offset).toBe(UPLOAD_MAX_CHUNK_SIZE);
      expect(chunks[1]!.data.length).toBe(500 - UPLOAD_MAX_CHUNK_SIZE);
      expect(chunks[1]!.data).toEqual(imageData.slice(UPLOAD_MAX_CHUNK_SIZE));
    });

    it("should handle three chunks correctly", () => {
      const imageData = new Uint8Array(600);
      for (let i = 0; i < 600; i++) imageData[i] = i % 256;

      const chunks = splitIntoUploadChunks(imageData);

      expect(chunks).toHaveLength(3);
      expect(chunks[0]!.offset).toBe(0);
      expect(chunks[0]!.data.length).toBe(UPLOAD_MAX_CHUNK_SIZE);
      expect(chunks[1]!.offset).toBe(UPLOAD_MAX_CHUNK_SIZE);
      expect(chunks[1]!.data.length).toBe(UPLOAD_MAX_CHUNK_SIZE);
      expect(chunks[2]!.offset).toBe(UPLOAD_MAX_CHUNK_SIZE * 2);
      expect(chunks[2]!.data.length).toBe(600 - UPLOAD_MAX_CHUNK_SIZE * 2);
    });

    it("should return empty array for empty data", () => {
      const imageData = new Uint8Array(0);

      const chunks = splitIntoUploadChunks(imageData);

      expect(chunks).toHaveLength(0);
    });

    describe("boundary tests", () => {
      it.each([
        {
          name: "MAX_CHUNK_SIZE - 1",
          size: UPLOAD_MAX_CHUNK_SIZE - 1,
          expectedChunks: 1,
          expectedLastChunkSize: UPLOAD_MAX_CHUNK_SIZE - 1,
        },
        {
          name: "exactly MAX_CHUNK_SIZE",
          size: UPLOAD_MAX_CHUNK_SIZE,
          expectedChunks: 1,
          expectedLastChunkSize: UPLOAD_MAX_CHUNK_SIZE,
        },
        {
          name: "MAX_CHUNK_SIZE + 1",
          size: UPLOAD_MAX_CHUNK_SIZE + 1,
          expectedChunks: 2,
          expectedLastChunkSize: 1,
        },
      ])(
        "should handle $name bytes correctly",
        ({ size, expectedChunks, expectedLastChunkSize }) => {
          const imageData = new Uint8Array(size).fill(0xaa);

          const chunks = splitIntoUploadChunks(imageData);

          expect(chunks).toHaveLength(expectedChunks);
          expect(chunks[chunks.length - 1]!.data.length).toBe(
            expectedLastChunkSize,
          );

          // Verify all offsets are correct
          let expectedOffset = 0;
          for (const chunk of chunks) {
            expect(chunk.offset).toBe(expectedOffset);
            expectedOffset += chunk.data.length;
          }
          expect(expectedOffset).toBe(size);
        },
      );
    });
  });

  describe("getNextDownloadChunkLength", () => {
    it("should return max chunk size when remaining exceeds it", () => {
      const result = getNextDownloadChunkLength(0, 500);

      expect(result).toBe(DOWNLOAD_MAX_CHUNK_SIZE);
    });

    it("should return remaining size when less than max chunk size", () => {
      const result = getNextDownloadChunkLength(0, 100);

      expect(result).toBe(100);
    });

    it("should calculate correctly from middle of download", () => {
      const offset = 200;
      const totalSize = 500;

      const result = getNextDownloadChunkLength(offset, totalSize);

      expect(result).toBe(DOWNLOAD_MAX_CHUNK_SIZE);
    });

    it("should return correct length for last partial chunk", () => {
      const totalSize = 300;
      const offset = DOWNLOAD_MAX_CHUNK_SIZE; // After first chunk

      const result = getNextDownloadChunkLength(offset, totalSize);

      expect(result).toBe(totalSize - DOWNLOAD_MAX_CHUNK_SIZE);
    });

    it("should return 0 when at end of download", () => {
      const totalSize = 100;

      const result = getNextDownloadChunkLength(totalSize, totalSize);

      expect(result).toBe(0);
    });

    describe("boundary tests", () => {
      it.each([
        {
          name: "MAX_CHUNK_SIZE - 1",
          totalSize: DOWNLOAD_MAX_CHUNK_SIZE - 1,
          expectedLength: DOWNLOAD_MAX_CHUNK_SIZE - 1,
        },
        {
          name: "exactly MAX_CHUNK_SIZE",
          totalSize: DOWNLOAD_MAX_CHUNK_SIZE,
          expectedLength: DOWNLOAD_MAX_CHUNK_SIZE,
        },
        {
          name: "MAX_CHUNK_SIZE + 1",
          totalSize: DOWNLOAD_MAX_CHUNK_SIZE + 1,
          expectedLength: DOWNLOAD_MAX_CHUNK_SIZE,
        },
      ])(
        "should handle $name bytes correctly",
        ({ totalSize, expectedLength }) => {
          const result = getNextDownloadChunkLength(0, totalSize);

          expect(result).toBe(expectedLength);
        },
      );

      it("should return 1 byte for second chunk when size is MAX_CHUNK_SIZE + 1", () => {
        const totalSize = DOWNLOAD_MAX_CHUNK_SIZE + 1;

        const result = getNextDownloadChunkLength(
          DOWNLOAD_MAX_CHUNK_SIZE,
          totalSize,
        );

        expect(result).toBe(1);
      });
    });
  });

  describe("constants", () => {
    it("should have correct upload max chunk size", () => {
      // APDU max payload (255) - 4 bytes for offset
      expect(UPLOAD_MAX_CHUNK_SIZE).toBe(251);
    });

    it("should have correct download max chunk size", () => {
      // APDU response max (240) - 2 bytes for status
      expect(DOWNLOAD_MAX_CHUNK_SIZE).toBe(238);
    });
  });
});
