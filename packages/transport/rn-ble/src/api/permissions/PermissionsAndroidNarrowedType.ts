import {
  type Permission,
  type PermissionsAndroid,
  type PermissionStatus,
} from "react-native";

/**
 * This is a bit of a hack to make the code more readable by accessing those constants directly.
 * As in RN prior to 0.77, the type of PERMISSIONS and RESULTS is just a dictionnary...
 * But it's value is actually a static object always containing the same values.
 * */
export type PermissionsAndroidNarrowedType = typeof PermissionsAndroid & {
  PERMISSIONS: {
    ACCESS_COARSE_LOCATION: Permission;
    ACCESS_FINE_LOCATION: Permission;
    BLUETOOTH_SCAN: Permission;
    BLUETOOTH_CONNECT: Permission;
  };
  RESULTS: {
    GRANTED: PermissionStatus;
    DENIED: PermissionStatus;
    NEVER_ASK_AGAIN: PermissionStatus;
  };
};
