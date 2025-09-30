export interface PermissionsService {
  checkRequiredPermissions(): Promise<boolean>;
  requestRequiredPermissions(): Promise<boolean>;
}
