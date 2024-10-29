import axios from "axios";
import { Left, Right } from "purify-ts";

import { type ForwardDomainDataSource } from "@/forward-domain/data/ForwardDomainDataSource";
import { HttpForwardDomainDataSource } from "@/forward-domain/data/HttpForwardDomainDataSource";
import PACKAGE from "@root/package.json";

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

  it("should return an error when no payload is returned", async () => {
    // GIVEN
    const response = { data: { test: "" } };
    jest.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getDomainNamePayload({
      challenge: "",
      domain: "hello.eth",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpForwardDomainDataSource: error getting domain payload",
        ),
      ),
    );
  });

  it("should throw an error when axios throws an error", async () => {
    // GIVEN
    jest.spyOn(axios, "request").mockRejectedValue(new Error());

    // WHEN
    const result = await datasource.getDomainNamePayload({
      challenge: "",
      domain: "hello.eth",
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpForwardDomainDataSource: Failed to fetch domain name",
        ),
      ),
    );
  });

  it("should return a payload", async () => {
    // GIVEN
    const response = { data: { payload: "payload" } };
    jest.spyOn(axios, "request").mockResolvedValue(response);

    // WHEN
    const result = await datasource.getDomainNamePayload({
      challenge: "challenge",
      domain: "hello.eth",
    });

    // THEN
    expect(result).toEqual(Right("payload"));
  });
});
