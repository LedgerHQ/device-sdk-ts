import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type SignActionsDAReturnType } from "@api/app-binder/SignActionsDeviceActionTypes";
import { type SignerHyperliquid } from "@api/SignerHyperliquid";
import { makeContainer } from "@internal/di";
import { actionsTypes } from "@internal/use-cases/actions/di/actionsTypes";
import { type SignActionsUseCase } from "@internal/use-cases/actions/SignActionsUseCase";

type DefaultSignerHyperliquidConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSignerHyperliquid implements SignerHyperliquid {
  private readonly _container: Container;

  constructor({ dmk, sessionId }: DefaultSignerHyperliquidConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId });
  }

  signActions(
    params: Parameters<SignerHyperliquid["signActions"]>[0],
  ): SignActionsDAReturnType {
    return this._container
      .get<SignActionsUseCase>(actionsTypes.SignActionsUseCase)
      .execute(params);
  }
}
