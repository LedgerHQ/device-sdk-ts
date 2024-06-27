import axios from "axios";

import { ForwardDomainDataSource } from "@/forward-domain/data/ForwardDomainDataSource";
import { HttpForwardDomainDataSource } from "@/forward-domain/data/HttpForwardDomainDataSource";
import PACKAGE from "@root/package.json";

import {} from "./ForwardDomainDataSource";

jest.mock("axios");

describe("HttpForwardDomainDataSource", () => {
  let datasource: ForwardDomainDataSource;

  beforeAll(() => {
    datasource = new HttpForwardDomainDataSource();
    jest.clearAllMocks();
  });

  it("should call axios with the ledger client version header", async () => {
    // GIVEN
    const version = `context-module/${PACKAGE.version}`;
    const requestSpy = jest.fn(() => Promise.resolve({ data: [] }));
    jest.spyOn(axios, "request").mockImplementation(requestSpy);

    // WHEN
    await datasource.getDomainNamePayload({
      challenge: "",
      domain: "hello.eth",
    });

    // THEN
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { "X-Ledger-Client-Version": version },
      }),
    );
  });

  it("should return undefined when no payload is returned", async () => {
    // GIVEN
    const response = { data: { test: "" } };
    jest.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getDomainNamePayload({
      challenge: "",
      domain: "hello.eth",
    });

    // THEN
    expect(result).toEqual(undefined);
  });

  it("should return undefined when axios throws an error", async () => {
    // GIVEN
    jest.spyOn(axios, "request").mockRejectedValue(new Error());

    // WHEN
    const result = await datasource.getDomainNamePayload({
      challenge: "",
      domain: "hello.eth",
    });

    // THEN
    expect(result).toEqual(undefined);
  });
});
