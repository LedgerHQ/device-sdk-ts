import { Left, Right } from "purify-ts";
import { assign, fromObservable, fromPromise, setup } from "xstate";

import { isSuccessCommandResult } from "@api/command/model/CommandResult";
import {
  GetOsVersionCommand,
  type GetOsVersionResponse,
} from "@api/command/os/GetOsVersionCommand";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { DEFAULT_UNLOCK_TIMEOUT_MS } from "@api/device-action/os/Const";
import { GoToDashboardDeviceAction } from "@api/device-action/os/GoToDashboard/GoToDashboardDeviceAction";
import { type StateMachineTypes } from "@api/device-action/xstate-utils/StateMachineTypes";
import {
  type DeviceActionStateMachine,
  XStateDeviceAction,
} from "@api/device-action/xstate-utils/XStateDeviceAction";
import {
  type GenuineCheckDAError,
  type GenuineCheckDAInput,
  type GenuineCheckDAIntermediateValue,
  type GenuineCheckDAOutput,
  type GenuineCheckStateMachineInternalState,
  type Input,
  type MachineDependencies,
} from "@api/secure-channel/device-action/GenuineCheck/types";
import { ConnectToSecureChannelTask } from "@api/secure-channel/task/ConnectToSecureChannelTask";
import { SecureChannelEventType } from "@api/secure-channel/task/types";
import { isDeviceGenuine } from "@api/secure-channel/utils";
import { type DeviceVersion } from "@internal/manager-api/model/Device";
import { type FinalFirmware } from "@internal/manager-api/model/Firmware";

export class GenuineCheckDeviceAction extends XStateDeviceAction<
  GenuineCheckDAOutput,
  GenuineCheckDAInput,
  GenuineCheckDAError,
  GenuineCheckDAIntermediateValue,
  GenuineCheckStateMachineInternalState
> {
  protected override makeStateMachine(
    internalApi: InternalApi,
  ): DeviceActionStateMachine<
    GenuineCheckDAOutput,
    GenuineCheckDAInput,
    GenuineCheckDAError,
    GenuineCheckDAIntermediateValue,
    GenuineCheckStateMachineInternalState
  > {
    type types = StateMachineTypes<
      GenuineCheckDAOutput,
      GenuineCheckDAInput,
      GenuineCheckDAError,
      GenuineCheckDAIntermediateValue,
      GenuineCheckStateMachineInternalState
    >;

    const { getOsVersion, getDeviceVersion, getFirmwareVersion, genuineCheck } =
      this.extractDependencies(internalApi);

    const unlockTimeout = this.input.unlockTimeout ?? DEFAULT_UNLOCK_TIMEOUT_MS;

    const goToDashboardMachine = new GoToDashboardDeviceAction({
      input: {
        unlockTimeout,
      },
    }).makeStateMachine(internalApi);

    return setup({
      types: {
        input: {} as types["input"],
        context: {} as types["context"],
        output: {} as types["output"],
      },
      actors: {
        goToDashboard: goToDashboardMachine,
        getOsVersion: fromPromise(getOsVersion),
        getDeviceVersion: fromPromise(getDeviceVersion),
        getFirmwareVersion: fromPromise(getFirmwareVersion),
        genuineCheck: fromObservable(genuineCheck),
      },
      guards: {
        hasError: (_) => _.context._internalState.error !== null,
      },
      actions: {
        assignErrorFromEvent: assign({
          _internalState: (_) => ({
            ..._.context._internalState,
            error: _.event["error"],
          }),
        }),
      },
    }).createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QHEwDsCuBLNYDCAFmAMYDWAImAG5bFgCCxALlgPZoB0lNdASmAEMIATwDEAbQAMAXUSgADq1hYW7OSAAeiAIwB2AGwAWDvskBOAKwAmC9YvbJADkMAaEMMQBmT2ZPazuo6SFp6SDpKG+gC+UW6omDj4RGTctAzMbJzIrAAqrOQCsAQARqwCAE4QohDsYBw4VKykdVC5+YUlZZVSskggisqqaOpaCFaGntocEwaOFkYR2oa6bh4IZsEcuta6Nmbajp76tjFx6Ni4hCQU1GmMQxzZeQVFpRVVYOXlrOUc8gA2AiYADMfgBbDitZ4dN7dGTqAYqTIjRDjSbTTyzeaGRbLVaIOa6LY7PYHI4nWIgeIXJLXVJ0e6ZR5tF6dd5XMgSeF9RFDFFjQ5WExhXQbYKGRxWKwrdyoo4cbT+UUOQz+UyeU5U86JDk3HjpB5PdqvLoQXUSbS9BRKJFqPqjKyC4V6MUWCVSmVrfySBVKsxSyxmAKSaKU6k65J6u4ZdiPMBMADysAAap9lOxqrV6mhGs1IfGk6nyum0D0ETa+favJFPNNDBtHAcQ8cQ-j1qEOJ43d5JMFG8dDJrw5dI-SDUzUImU2nMuayzyK8iq2NDELtoFVWZ9JilmY2-X9BxnNvbLYjBMzEPtSO6bcGTGsgXp8XZ5GLVb+ou7aAHaviRu1R3es220Kx-A4EMbEmVcg0kaUrwSG8UjvcdY0nQsZ3YOcrA-Xklx-LwfE7CwzExCwQNCWtJhsZY3W2YIEJpXUx0ZND4zHIsS0zXBs1zFp2JQzjMnna1BnwzREAMYxJUWTFnEseYQKscwOAsOYt17UVnClRiI1vfVWMfJgOMwtBRE+b5fgBIFQXKCEYGMwTTJEz8xO-CSECko9lNVOT6zPNt9G0CxOxrN1-TMVcKTORDaWQgyHzjRz9SErC3xcvD3NGUDQM7fRdlFLtJCOfQ23XVTdn9TTzGlCxdKQqN70NASUtMudLXLNzhmXHKhSOArSIsYr9FK2UEFAojKoOWx9kMCxdHquLGtQoyADEsDsgB3CowFSsyah4homn4ph1q2na9oyr9uoI8avNMSwbDsBxnBAhwQu8EjbFAkJlKsRbmJQwykrOsFtvKXbTPMr4fj+QEQXBfNTo2sGLuc7lRNtG6PL0IxhUe2wbBe1wxomn0bCsILV18rc6rDa8lpYxLJ1B8HIZfNLri5XDrv5KxQmMbQjHGbZG2U3RPR0bQu2mZUgm3fRBo1enYsBhLmuR86Ib29qea6vmBYVYXaLFyQJbbAJfF7SmJhsUVlMvFWmNHIHmYZ80DrqI68xgVXIyu-Xl0dCUtkVsDdG8CPdEMEmvQiIlHA2Bxau2ZYAZd9WJ3dt8LNh6yEbs-M-euAOsb5p1TBdXs3UlaU20cAwIKmyKL3MbR0-06NmuLsg5wx1yy+XSiTAb8jSaOKZqLo6eGKdvT4q7rOe9IXXOsH27h-0UeQM3Tsfto2jZ8pNBWAgOB1GHRnXcrTGb48gBaaWfQOaVgkiswZNe0m4L8D+zc8VUL8Y4dwXk1JkY5+BCDWLfcS2UgohWjvzNEIR7AHDbN4Rwv8ghDXrLoEMIDlrAyNKyWEEA1532ykGQ8CxGwhhxKqPEY1JghUVAEfK2wwKJwmAQpmhoWQwlNLqchsDUTzV8CLUwoogwlTbB6DglhQj6GlAcCWkceHXyzlOPawispeH8Jgrs5JFaV3sPuIW0x9gyXrPsEajh1GZzYlotqkYdHY1GPfSUCpJR4JIvWT+scCRqQ4A7bwoF+YREHHPBqvDNEmQ5tjTKbjEA4hCiRTwMl7DFXegE8a-haxi2nofOmMVnadzAY4uJJYhELkDrdD+UwDDzQiPNSmp4lLonmDREiVVQwlPnoQt2mtUba1Mq4-k0ttjBOKnbROxi0GkzAsYZYVU9DmDfv9KJV8HFrRRmzHWLianrw8spABCocSNgjkNeaRw3rSj3jRBwZF0n2MXmxZeYyg7zEwZcx0jhJSRTCJ4CiMdVJWGkb8tSQs7GbLVq8x8y9qkwN0QgSQO9+aqSUW6bpykSLQr6dEjRsYADKGBiB0FgPAQ5FCvBmx9LYeskQIqOGOECsasFgnWCUYcOalgnAvPKZwAAojDcoHyN60tUuFRlYLmUhDKtYCCeg5LMu8KRaFMQgA */
      id: "GenuineCheckDeviceAction",
      initial: "DeviceReady",
      context: (_) => {
        return {
          input: {
            unlockTimeout: _.input.unlockTimeout,
          },
          intermediateValue: {
            history: [],
            requiredUserInteraction: UserInteractionRequired.None,
          },
          _internalState: {
            error: null,
            result: { isGenuine: false },
            getOsVersionResponse: null,
            deviceVersion: null,
            firmwareVersion: null,
          },
        };
      },
      states: {
        DeviceReady: {
          always: {
            target: "GoToDashboard",
          },
        },
        GoToDashboard: {
          invoke: {
            id: "goToDashboard",
            src: "goToDashboard",
            input: (_) => ({
              unlockTimeout: _.context.input.unlockTimeout,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => ({
                  ..._.context.intermediateValue,
                  requiredUserInteraction:
                    _.event.snapshot.context.intermediateValue
                      .requiredUserInteraction,
                }),
              }),
            },
            onDone: {
              target: "GoToDashboardCheck",
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<GenuineCheckStateMachineInternalState>(
                    {
                      Right: () => _.context._internalState,
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
                    },
                  );
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        GoToDashboardCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "GetOsVersion",
            },
          ],
        },
        GetOsVersion: {
          invoke: {
            id: "getOsVersion",
            src: "getOsVersion",
            input: (_) => undefined,
            onDone: {
              target: "GetOsVersionCheck",
              actions: assign({
                _internalState: (_) => {
                  if (isSuccessCommandResult(_.event.output)) {
                    return {
                      ..._.context._internalState,
                      getOsVersionResponse: _.event.output.data,
                    };
                  }
                  return {
                    ..._.context._internalState,
                    error: _.event.output.error,
                  };
                },
              }),
            },
          },
        },
        GetOsVersionCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "GetDeviceVersion",
            },
          ],
        },
        GetDeviceVersion: {
          invoke: {
            id: "getDeviceVersion",
            src: "getDeviceVersion",
            input: (_) => ({
              deviceInfo: _.context._internalState.getOsVersionResponse!,
            }),
            onDone: {
              target: "GetDeviceVersionCheck",
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<GenuineCheckStateMachineInternalState>(
                    {
                      Right: (deviceVersion) => ({
                        ..._.context._internalState,
                        deviceVersion,
                      }),
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
                    },
                  );
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        GetDeviceVersionCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            { target: "GetFirmwareVersion" },
          ],
        },
        GetFirmwareVersion: {
          invoke: {
            id: "getFirmwareVersion",
            src: "getFirmwareVersion",
            input: (_) => ({
              deviceInfo: _.context._internalState.getOsVersionResponse!,
              deviceVersion: _.context._internalState.deviceVersion!,
            }),
            onDone: {
              target: "GetFirmwareVersionCheck",
              actions: assign({
                _internalState: (_) => {
                  return _.event.output.caseOf<GenuineCheckStateMachineInternalState>(
                    {
                      Right: (firmwareVersion) => ({
                        ..._.context._internalState,
                        firmwareVersion,
                      }),
                      Left: (error) => ({
                        ..._.context._internalState,
                        error,
                      }),
                    },
                  );
                },
              }),
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        GetFirmwareVersionCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            { target: "GenuineCheck" },
          ],
        },
        GenuineCheck: {
          invoke: {
            id: "genuineCheck",
            src: "genuineCheck",
            input: (_) => ({
              deviceInfo: _.context._internalState.getOsVersionResponse!,
              finalFirmware: _.context._internalState.firmwareVersion!,
            }),
            onSnapshot: {
              actions: assign({
                intermediateValue: (_) => {
                  const history = _.context.intermediateValue.history
                    .concat(_.event.snapshot.context ?? [])
                    .slice(-3); // keep only the last 3 events
                  switch (_.event.snapshot.context?.type) {
                    case SecureChannelEventType.PermissionRequested: {
                      return {
                        history,
                        requiredUserInteraction:
                          UserInteractionRequired.AllowSecureConnection,
                      };
                    }
                    case SecureChannelEventType.PermissionGranted: {
                      return {
                        history,
                        requiredUserInteraction: UserInteractionRequired.None,
                      };
                    }
                    default:
                      return {
                        ..._.context.intermediateValue,
                        history,
                      };
                  }
                },
                _internalState: (_) => {
                  if (
                    _.event.snapshot.context?.type ===
                    SecureChannelEventType.Result
                  ) {
                    return {
                      ..._.context._internalState,
                      result: {
                        isGenuine: isDeviceGenuine(
                          _.event.snapshot.context.payload,
                        ),
                      },
                    };
                  }
                  return _.context._internalState;
                },
              }),
            },
            onDone: {
              target: "GenuineCheckCheck",
            },
            onError: {
              target: "Error",
              actions: "assignErrorFromEvent",
            },
          },
        },
        GenuineCheckCheck: {
          always: [
            {
              target: "Error",
              guard: "hasError",
            },
            {
              target: "Success",
            },
          ],
        },
        Success: {
          type: "final",
        },
        Error: {
          type: "final",
        },
      },
      output: (_) => {
        if (_.context._internalState.error) {
          return Left(_.context._internalState.error);
        } else {
          return Right(_.context._internalState.result);
        }
      },
    });
  }

  private extractDependencies(internalApi: InternalApi): MachineDependencies {
    const provider = 1; // TODO: get the provider from user configuration

    const getOsVersion = () =>
      internalApi.sendCommand(new GetOsVersionCommand());

    const getDeviceVersion = ({
      input,
    }: Input<{ deviceInfo: GetOsVersionResponse }>) => {
      const { deviceInfo } = input;
      return internalApi
        .getManagerApiService()
        .getDeviceVersion(deviceInfo, provider);
    };

    const getFirmwareVersion = ({
      input,
    }: Input<{
      deviceInfo: GetOsVersionResponse;
      deviceVersion: DeviceVersion;
    }>) => {
      const { deviceInfo, deviceVersion } = input;
      return internalApi
        .getManagerApiService()
        .getFirmwareVersion(deviceInfo, deviceVersion, provider);
    };

    const genuineCheck = ({
      input,
    }: Input<{
      deviceInfo: GetOsVersionResponse;
      finalFirmware: FinalFirmware;
    }>) => {
      const { deviceInfo, finalFirmware } = input;
      const eitherConnection = internalApi
        .getSecureChannelService()
        .genuineCheck(deviceInfo, finalFirmware);
      return new ConnectToSecureChannelTask(internalApi, {
        connection: eitherConnection,
      }).run();
    };

    return {
      getOsVersion,
      getDeviceVersion,
      getFirmwareVersion,
      genuineCheck,
    };
  }
}
