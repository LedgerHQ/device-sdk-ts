import { type PermissionsService } from "./PermissionsService";

export class DefaultPermissionsService implements PermissionsService {
  checkRequiredPermissions(): Promise<boolean> {
    return Promise.resolve(true);
  }

  requestRequiredPermissions(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
