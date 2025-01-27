import { inject, injectable } from "inversify";

import {
  DeviceAction,
  DeviceActionIntermediateValue,
  ExecuteDeviceActionReturnType,
} from "@api/device-action/DeviceAction";
import { DmkError } from "@api/Error";
import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import type { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";

export type ExecuteDeviceActionUseCaseArgs<
  Output,
  Input,
  Error extends DmkError,
  IntermediateValue extends DeviceActionIntermediateValue,
> = {
  /**
   * The device session id.
   */
  readonly sessionId: string;
  /**
   * The device action to execute.
   */
  readonly deviceAction: DeviceAction<Output, Input, Error, IntermediateValue>;
};

/**
 * Executes a device action to a device through a device session.
 */
@injectable()
export class ExecuteDeviceActionUseCase {
  private readonly _sessionService: DeviceSessionService;
  private readonly _logger: LoggerPublisherService;
  constructor(
    @inject(deviceSessionTypes.DeviceSessionService)
    sessionService: DeviceSessionService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessionService = sessionService;
    this._logger = loggerFactory("ExecuteDeviceActionUseCase");
  }

  /**
   * Executes a device action to a device through a device session.
   *
   * @param sessionId - The device session id.
   * @param deviceAction - The device action to execute
   * @returns An object containing an observable of the device action state, and a cancel function.
   */
  execute<
    Output,
    Error extends DmkError,
    IntermediateValue extends DeviceActionIntermediateValue,
    Input,
  >({
    sessionId,
    deviceAction,
  }: ExecuteDeviceActionUseCaseArgs<
    Output,
    Input,
    Error,
    IntermediateValue
  >): ExecuteDeviceActionReturnType<Output, Error, IntermediateValue> {
    const deviceSessionOrError =
      this._sessionService.getDeviceSessionById(sessionId);

    return deviceSessionOrError.caseOf({
      // Case device session found
      Right: (deviceSession) =>
        deviceSession.executeDeviceAction<
          Output,
          Input,
          Error,
          IntermediateValue
        >(deviceAction),
      // Case device session not found
      Left: (error) => {
        this._logger.error("Error getting session", {
          data: { error },
        });
        throw error;
      },
    });
  }
}
