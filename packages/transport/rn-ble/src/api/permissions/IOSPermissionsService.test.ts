import { DefaultPermissionsService } from "./DefaultPermissionsService";

describe("DefaultPermissionsService", () => {
  describe("checkRequiredPermissions", () => {
    it("should return true", async () => {
      const permissionsService = new DefaultPermissionsService();

      const result = await permissionsService.checkRequiredPermissions();
      expect(result).toEqual(true);
    });
  });

  describe("requestRequiredPermissions", () => {
    it("should return true", async () => {
      const permissionsService = new DefaultPermissionsService();
      const result = await permissionsService.requestRequiredPermissions();
      expect(result).toEqual(true);
    });
  });
});
