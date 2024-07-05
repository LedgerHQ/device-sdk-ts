import { inject, injectable } from "inversify";

import { Signature, TypedData } from "@api/index";
import { AppBindingEth } from "@internal/app-binding/AppBindingEth";
import { appBindingTypes } from "@internal/app-binding/di/appBindingTypes";
import { typedDataTypes } from "@internal/typed-data/di/typedDataTypes";
import { TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

@injectable()
export class SignTypedDataUseCase {
  private _appBinding: AppBindingEth;
  private _parser: TypedDataParserService;

  constructor(
    @inject(appBindingTypes.AppBinding) appBinding: AppBindingEth,
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
