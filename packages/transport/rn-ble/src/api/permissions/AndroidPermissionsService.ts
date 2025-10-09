import type { Permission } from "react-native";

import type { PermissionsAndroidNarrowedType } from "./PermissionsAndroidNarrowedType";
import { type PermissionsService } from "./PermissionsService";

export class AndroidPermissionsService implements PermissionsService {
  constructor(
    private readonly _permissionsAndroid: PermissionsAndroidNarrowedType,
    private readonly _apiLevel: number,
  ) {}

  getRequiredPermissions(): Permission[] {
    if (this._apiLevel <= 28) {
      return [this._permissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];
    }

    if (this._apiLevel <= 30) {
      return [this._permissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    }

    return [
      this._permissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      this._permissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ];
  }

  async checkRequiredPermissions(): Promise<boolean> {
    const allPermissions = this.getRequiredPermissions();

    const allPermissionsCheckResults = await Promise.all(
      allPermissions.map((permission) =>
        this._permissionsAndroid.check(permission),
      ),
    );

    const allPermissionsGranted = allPermissionsCheckResults.every(
      (granted) => granted,
    );

    return allPermissionsGranted;
  }

  async requestRequiredPermissions(): Promise<boolean> {
    const allPermissions = this.getRequiredPermissions();

    const allPermissionsRequestResults =
      await this._permissionsAndroid.requestMultiple(allPermissions);

    const allPermissionsGrantedAfterRequest = Object.values(
      allPermissionsRequestResults,
    ).every(
      (requested) => requested === this._permissionsAndroid.RESULTS.GRANTED,
    );

    return allPermissionsGrantedAfterRequest;
  }
}
