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

  describe("bytesToNumber", () => {
    it("should return a correct number", () => {
      // Arrange
      const array = new Uint8Array([0x67, 0x89]);
      // Act
      const result = FramerUtils.bytesToNumber(array);
      // Assert
      expect(result).toEqual(26505);
    });
    it("should return 0 when array is empty", () => {
      // Arrange
      const array = new Uint8Array([]);
      // Act
      const result = FramerUtils.bytesToNumber(array);
      // Assert
      expect(result).toEqual(0);
    });
  });

  describe("numberToByteArray", () => {
    it("should return a correct Uint8Array", () => {
      // Arrange
      const number = 26505;
      const size = 2;
      // Act
      const result = FramerUtils.numberToByteArray(number, size);
      // Assert
      expect(result).toEqual(new Uint8Array([0x67, 0x89]));
    });
    it("should return a filled Uint8Array when number is 0 and size is 2", () => {
      // Arrange
      const number = 0;
      const size = 2;
      // Act
      const result = FramerUtils.numberToByteArray(number, size);
      // Assert
      expect(result).toEqual(new Uint8Array([0, 0]));
    });
    it("should return an empty Uint8Array when number is 42 and size is 0", () => {
      // Arrange
      const number = 42;
      const size = 0;
      // Act
      const result = FramerUtils.numberToByteArray(number, size);
      // Assert
      expect(result).toEqual(new Uint8Array([]));
    });
  });
});
