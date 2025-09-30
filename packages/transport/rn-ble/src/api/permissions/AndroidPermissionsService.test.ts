import { type Permission } from "react-native";

import { AndroidPermissionsService } from "./AndroidPermissionsService";
import { type PermissionsAndroidNarrowedType } from "./PermissionsAndroidNarrowedType";

const PERMISSIONS = {
  ACCESS_COARSE_LOCATION: "android.permission.ACCESS_COARSE_LOCATION",
  ACCESS_FINE_LOCATION: "android.permission.ACCESS_FINE_LOCATION",
  BLUETOOTH_SCAN: "android.permission.BLUETOOTH_SCAN",
  BLUETOOTH_CONNECT: "android.permission.BLUETOOTH_CONNECT",
};

const RESULTS = {
  GRANTED: "granted",
  DENIED: "denied",
  NEVER_ASK_AGAIN: "never_ask_again",
};

function createMockPermissionsAndroid(
  checkResults: Partial<Record<Permission, boolean>> = {},
  requestResults: Partial<Record<Permission, PermissionStatus>> = {},
): PermissionsAndroidNarrowedType {
  return {
    request: vi.fn(),
    requestMultiple: vi
      .fn()
      .mockImplementation(() => Promise.resolve(requestResults)),
    check: vi
      .fn()
      .mockImplementation((permission: Permission) => checkResults[permission]),
    PERMISSIONS,
    RESULTS,
  } as unknown as PermissionsAndroidNarrowedType;
}

describe("AndroidPermissionsService", () => {
  describe("getRequiredPermissions", () => {
    const expectedPermissions = {
      27: [PERMISSIONS.ACCESS_COARSE_LOCATION],
      28: [PERMISSIONS.ACCESS_COARSE_LOCATION],
      29: [PERMISSIONS.ACCESS_FINE_LOCATION],
      30: [PERMISSIONS.ACCESS_FINE_LOCATION],
      31: [PERMISSIONS.BLUETOOTH_SCAN, PERMISSIONS.BLUETOOTH_CONNECT],
      32: [PERMISSIONS.BLUETOOTH_SCAN, PERMISSIONS.BLUETOOTH_CONNECT],
    };

    Object.entries(expectedPermissions).forEach(([apiLevel, permissions]) => {
      it(`should return the correct permissions for API ${apiLevel}`, () => {
        const permissionsAndroid = createMockPermissionsAndroid();
        const permissionsService = new AndroidPermissionsService(
          permissionsAndroid,
          parseInt(apiLevel),
        );
        expect(permissionsService.getRequiredPermissions()).toEqual(
          permissions,
        );
      });
    });
  });

  describe("checkRequiredPermissions", () => {
    describe("Android <= 28", () => {
      [27, 28].forEach((apiLevel) => {
        it(`should return true if ACCESS_COARSE_LOCATION is granted for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid({
            [PERMISSIONS.ACCESS_COARSE_LOCATION]: true,
          });
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.checkRequiredPermissions();
          expect(result).toEqual(true);
        });

        it(`should return false if ACCESS_COARSE_LOCATION is denied for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid({
            [PERMISSIONS.ACCESS_COARSE_LOCATION]: false,
          });
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.checkRequiredPermissions();
          expect(result).toEqual(false);
        });
      });
    });

    describe("Android 29, 30", () => {
      [29, 30].forEach((apiLevel) => {
        it(`should return true if ACCESS_FINE_LOCATION is granted for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid({
            [PERMISSIONS.ACCESS_FINE_LOCATION]: true,
          });
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.checkRequiredPermissions();
          expect(result).toEqual(true);
        });

        it(`should return false if ACCESS_FINE_LOCATION is denied for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid({
            [PERMISSIONS.ACCESS_FINE_LOCATION]: false,
          });
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.checkRequiredPermissions();
          expect(result).toEqual(false);
        });
      });
    });

    describe("Android >= 31", () => {
      [31, 32].forEach((apiLevel) => {
        it(`should return true if BLUETOOTH_SCAN and BLUETOOTH_CONNECT are granted for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid({
            [PERMISSIONS.BLUETOOTH_SCAN]: true,
            [PERMISSIONS.BLUETOOTH_CONNECT]: true,
          });
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.checkRequiredPermissions();
          expect(result).toEqual(true);
        });

        it(`should return false if BLUETOOTH_SCAN is denied for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid({
            [PERMISSIONS.BLUETOOTH_SCAN]: false,
            [PERMISSIONS.BLUETOOTH_CONNECT]: true,
          });
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.checkRequiredPermissions();
          expect(result).toEqual(false);
        });

        it(`should return false if BLUETOOTH_CONNECT is denied for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid({
            [PERMISSIONS.BLUETOOTH_SCAN]: true,
            [PERMISSIONS.BLUETOOTH_CONNECT]: false,
          });
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.checkRequiredPermissions();
          expect(result).toEqual(false);
        });

        it(`should return false if BLUETOOTH_SCAN and BLUETOOTH_CONNECT are denied for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid({
            [PERMISSIONS.BLUETOOTH_SCAN]: false,
            [PERMISSIONS.BLUETOOTH_CONNECT]: false,
          });
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.checkRequiredPermissions();
          expect(result).toEqual(false);
        });
      });
    });
  });

  describe("requestRequiredPermissions", () => {
    describe("Android <= 28", () => {
      [27, 28].forEach((apiLevel) => {
        it(`should return true if ACCESS_COARSE_LOCATION is granted for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid(
            {},
            {
              [PERMISSIONS.ACCESS_COARSE_LOCATION]: RESULTS.GRANTED,
            },
          );
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.requestRequiredPermissions();
          expect(result).toEqual(true);
        });

        it(`should return false if ACCESS_COARSE_LOCATION is denied for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid(
            {},
            {
              [PERMISSIONS.ACCESS_COARSE_LOCATION]: RESULTS.DENIED,
            },
          );
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.requestRequiredPermissions();
          expect(result).toEqual(false);
        });

        it(`should return false if ACCESS_COARSE_LOCATION is never ask again for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid(
            {},
            {
              [PERMISSIONS.ACCESS_COARSE_LOCATION]: RESULTS.NEVER_ASK_AGAIN,
            },
          );
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.requestRequiredPermissions();
          expect(result).toEqual(false);
        });
      });
    });

    describe("Android >= 29", () => {
      [29, 30].forEach((apiLevel) => {
        it(`should return true if ACCESS_FINE_LOCATION is granted for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid(
            {},
            {
              [PERMISSIONS.ACCESS_FINE_LOCATION]: RESULTS.GRANTED,
            },
          );
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.requestRequiredPermissions();
          expect(result).toEqual(true);
        });

        it(`should return false if ACCESS_FINE_LOCATION is denied for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid(
            {},
            {
              [PERMISSIONS.ACCESS_FINE_LOCATION]: RESULTS.DENIED,
            },
          );
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.requestRequiredPermissions();
          expect(result).toEqual(false);
        });

        it(`should return false if ACCESS_FINE_LOCATION is never ask again for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid(
            {},
            {
              [PERMISSIONS.ACCESS_FINE_LOCATION]: RESULTS.NEVER_ASK_AGAIN,
            },
          );
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.requestRequiredPermissions();
          expect(result).toEqual(false);
        });
      });
    });

    describe("Android >= 31", () => {
      [31, 32].forEach((apiLevel) => {
        it(`should return true if BLUETOOTH_SCAN and BLUETOOTH_CONNECT are granted for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid(
            {},
            {
              [PERMISSIONS.BLUETOOTH_SCAN]: RESULTS.GRANTED,
              [PERMISSIONS.BLUETOOTH_CONNECT]: RESULTS.GRANTED,
            },
          );
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.requestRequiredPermissions();
          expect(result).toEqual(true);
        });

        it(`should return false if BLUETOOTH_SCAN is denied for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid(
            {},
            {
              [PERMISSIONS.BLUETOOTH_SCAN]: RESULTS.DENIED,
              [PERMISSIONS.BLUETOOTH_CONNECT]: RESULTS.GRANTED,
            },
          );
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.requestRequiredPermissions();
          expect(result).toEqual(false);
        });

        it(`should return false if BLUETOOTH_CONNECT is denied for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid(
            {},
            {
              [PERMISSIONS.BLUETOOTH_SCAN]: RESULTS.GRANTED,
              [PERMISSIONS.BLUETOOTH_CONNECT]: RESULTS.DENIED,
            },
          );
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.requestRequiredPermissions();
          expect(result).toEqual(false);
        });

        it(`should return false if BLUETOOTH_SCAN and BLUETOOTH_CONNECT are denied for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid(
            {},
            {
              [PERMISSIONS.BLUETOOTH_SCAN]: RESULTS.DENIED,
              [PERMISSIONS.BLUETOOTH_CONNECT]: RESULTS.DENIED,
            },
          );

          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.requestRequiredPermissions();
          expect(result).toEqual(false);
        });

        it(`should return false if BLUETOOTH_SCAN and BLUETOOTH_CONNECT are never ask again for API ${apiLevel}`, async () => {
          const permissionsAndroid = createMockPermissionsAndroid(
            {},
            {
              [PERMISSIONS.BLUETOOTH_SCAN]: RESULTS.NEVER_ASK_AGAIN,
              [PERMISSIONS.BLUETOOTH_CONNECT]: RESULTS.NEVER_ASK_AGAIN,
            },
          );
          const permissionsService = new AndroidPermissionsService(
            permissionsAndroid,
            apiLevel,
          );

          const result = await permissionsService.requestRequiredPermissions();
          expect(result).toEqual(false);
        });
      });
    });
  });
});
