/**
 * Service responsible for pre-test device configuration (e.g. enabling blind signing)
 */
export interface DeviceSetupService {
  setup(): Promise<void>;
}
