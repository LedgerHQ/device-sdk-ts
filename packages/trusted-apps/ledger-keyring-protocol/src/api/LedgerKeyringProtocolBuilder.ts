import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { type CryptoService } from "@api/crypto/CryptoService";
import { NobleCryptoService } from "@api/crypto/noble/NobleCryptoService";
import { type LedgerKeyringProtocol } from "@api/LedgerKeyringProtocol";
import { type LKRPEnv } from "@api/model/Env";
import { DefaultLedgerKeyringProtocol } from "@internal/DefaultLedgerKeyringProtocol";

export class LedgerKeyringProtocolBuilder {
  private readonly dmk: DeviceManagementKit;
  private readonly applicationId: number;
  private readonly env?: LKRPEnv;
  private readonly baseUrl?: string;
  private cryptoService: CryptoService = new NobleCryptoService();

  constructor(args: {
    dmk: DeviceManagementKit;
    applicationId: number;
    env?: LKRPEnv;
    baseUrl?: string;
  }) {
    this.dmk = args.dmk;
    this.applicationId = args.applicationId;
    this.env = args.env;
    this.baseUrl = args.baseUrl;
  }

  withCryptoService(service: CryptoService): LedgerKeyringProtocolBuilder {
    this.cryptoService = service;
    return this;
  }

  build(): LedgerKeyringProtocol {
    return new DefaultLedgerKeyringProtocol({
      dmk: this.dmk,
      applicationId: this.applicationId,
      cryptoService: this.cryptoService,
      env: this.env,
      baseUrl: this.baseUrl,
    });
  }
}
