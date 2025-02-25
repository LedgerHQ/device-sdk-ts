/**
 * Parameters required to get the list of applications.
 *
 * @property targetId - The unique identifier of the target device, can be got from the response of the GetOsVersionCommand.
 * @property provider - The provider identifier.
 * @property firmwareVersionName - The firmware version of the device, can be obtained from the response of the GetOsVersionCommand, property name `seVersion`.
 */
export type GetAppListParams = {
  targetId: string;
  provider: number;
  firmwareVersionName: string;
};

/**
 * Parameters required to get applications by their hashes.
 *
 * @property hashes - An array of application hashes.
 */
export type GetAppByHashParams = {
  hashes: string[];
};

/**
 * Parameters required to get the device version.
 *
 * @property targetId - The unique identifier of the target device.
 * @property provider - The provider identifier.
 */
export type GetDeviceVersionParams = {
  targetId: string;
  provider: number;
};

/**
 * Parameters required to get the firmware version of a device.
 *
 * @property version - The version of the firmware, can be got from the response of the getDeviceVersion HTTP request.
 * @property deviceId - The unique identifier of the device, can be got from the GetOsVersionCommand response.
 * @property provider - The identifier of the firmware provider.
 */
export type GetFirmwareVersionParams = {
  version: string;
  deviceId: number;
  provider: number;
};
