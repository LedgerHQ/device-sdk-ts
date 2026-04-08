import {
  BackupDeserializationError,
  BackupSerializationError,
} from "@api/device-action/OsUpdate/Backup/Storage/BackSerializerErrors";
import {
  deserialize,
  serialize,
} from "@api/device-action/OsUpdate/Backup/Storage/BackupSerializer";

describe("BackupSerializer", () => {
  describe("Serialize", () => {
    describe("Success", () => {
      it("should serialize a backup to a JSON string", () => {
        // ARRANGE
        const backup = {
          languageId: 1,
          installedApps: [],
          clsHexImage: undefined,
          createdAt: new Date(),
        };
        const expected = JSON.stringify(backup);

        // ACT
        const result = serialize(backup);

        // ASSERT
        expect(result.isRight()).toBe(true);
        expect(result.extract()).toBe(expected);
      });
    });

    describe("Error", () => {
      it("should return a BackupSerializationError when the backup is invalid", () => {
        // ARRANGE
        const backup = {
          languageId: 1,
          installedApps: [],
          clsHexImage: undefined,
          createdAt: new Date(),
        };
        vi.spyOn(JSON, "stringify").mockImplementationOnce(() => {
          throw new Error("Invalid JSON");
        });

        // ACT
        const result = serialize(backup);

        // ASSERT
        expect(result.isLeft()).toBe(true);
        expect(result.extract()).toBeInstanceOf(BackupSerializationError);
      });
    });
  });

  describe("Deserialize", () => {
    describe("Success", () => {
      it("should deserialize a serialized backup", () => {
        // ARRANGE
        const backup = {
          languageId: 1,
          installedApps: [{ appName: "MyApp", data: undefined }],
          clsHexImage: undefined,
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
        };
        const json = serialize(backup).unsafeCoerce();

        // ACT
        const result = deserialize(json);

        // ASSERT
        expect(result.isRight()).toBe(true);
        expect(result.extract()).toEqual(backup);
      });
    });

    describe("Error", () => {
      it("should return a BackupDeserializationError when the JSON is invalid", () => {
        // ACT
        const result = deserialize("not-valid-json{{{");

        // ASSERT
        expect(result.isLeft()).toBe(true);
        expect(result.extract()).toBeInstanceOf(BackupDeserializationError);
      });

      it("should return a BackupDeserializationError when the decoded shape does not match", () => {
        // ARRANGE
        const json = JSON.stringify({ unexpected: "shape" });

        // ACT
        const result = deserialize(json);

        // ASSERT
        expect(result.isLeft()).toBe(true);
        expect(result.extract()).toBeInstanceOf(BackupDeserializationError);
      });
    });
  });
});
