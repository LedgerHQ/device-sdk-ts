import { inject, injectable } from "inversify";

import { SignTypedDataDAReturnType } from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { type TypedData } from "@api/model/TypedData";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { EthAppBinder } from "@internal/app-binder/EthAppBinder";
import { typedDataTypes } from "@internal/typed-data/di/typedDataTypes";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

@injectable()
export class SignTypedDataUseCase {
  private _appBinding: EthAppBinder;
  private _parser: TypedDataParserService;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinding: EthAppBinder,
    @inject(typedDataTypes.TypedDataParserService)
    typedDataParserService: TypedDataParserService,
  ) {
    this._appBinding = appBinding;
    this._parser = typedDataParserService;
  }

  execute(
    derivationPath: string,
    typedData: TypedData,
  ): SignTypedDataDAReturnType {
    return this._appBinding.signTypedData({
      derivationPath,
      parser: this._parser,
      data: typedData,
    });
  }
}
