import { injectable } from "inversify";

import { DeviceSessionService } from "./DeviceSessionService";

@injectable()
export class DefaultDeviceSessionService implements DeviceSessionService {
  constructor() {}
}
