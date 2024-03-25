import { FramerUtils } from "./FramerUtils";

describe("FramerUtils", () => {
  describe("getLastBytesFrom", () => {
    it("should return 2 same bytes of Uint8Array", () => {
      // Arrange
      const array = new Uint8Array([0x67, 0x89]);
      const size = 2;
      // Act
      const result = FramerUtils.getLastBytesFrom(array, size);
      // Assert
      expect(result).toEqual(new Uint8Array([0x67, 0x89]));
    });
    it("should return 2 last bytes of Uint8Array", () => {
      // Arrange
      const array = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const size = 2;
      // Act
      const result = FramerUtils.getLastBytesFrom(array, size);
      // Assert
      expect(result).toEqual(new Uint8Array([9, 10]));
    });
    it("should return empty Uint8Array", () => {
      // Arrange
      const array = new Uint8Array([]);
      const size = 2;
      // Act
      const result = FramerUtils.getLastBytesFrom(array, size);
      // Assert
      expect(result).toEqual(new Uint8Array([]));
    });
  });

  describe("getLastBytesFrom", () => {
    it("should return 2 same bytes of Uint8Array", () => {
      // Arrange
      const array = new Uint8Array([0x67, 0x89]);
      const size = 2;
      // Act
      const result = FramerUtils.getFirstBytesFrom(array, size);
      // Assert
      expect(result).toEqual(new Uint8Array([0x67, 0x89]));
    });
    it("should return 2 first bytes of Uint8Array", () => {
      // Arrange
      const array = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const size = 2;
      // Act
      const result = FramerUtils.getFirstBytesFrom(array, size);
      // Assert
      expect(result).toEqual(new Uint8Array([1, 2]));
    });
    it("should return empty Uint8Array", () => {
      // Arrange
      const array = new Uint8Array([]);
      const size = 2;
      // Act
      const result = FramerUtils.getLastBytesFrom(array, size);
      // Assert
      expect(result).toEqual(new Uint8Array([]));
    });
  });
});
