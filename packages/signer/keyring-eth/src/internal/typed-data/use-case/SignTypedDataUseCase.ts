import { inject, injectable } from "inversify";

import { Signature } from "@api/model/Signature";
import { TypedData } from "@api/model/TypedData";
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

  async execute(
    _derivationPath: string,
    _typedData: TypedData,
  ): Promise<Signature> {
    // 1- Parse the typed data and map it to a TypedDataContext
    // 2- Send the TypedDataContext to the app binding for signing
    // 2- Sign the transaction

    this._parser;
    this._appBinding;

    return Promise.resolve({} as Signature);
  }
}
