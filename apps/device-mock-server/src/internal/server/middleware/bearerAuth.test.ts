import { type Response } from "express";
import { Just, type Maybe, Nothing } from "purify-ts";
import { vi } from "vitest";

import {
  type AuthedRequest,
  bearerAuth,
  getSession,
} from "@internal/server/middleware/bearerAuth";
import { type SessionRepository } from "@internal/session/data/SessionRepository";
import { type SessionRecord } from "@internal/session/model/SessionModels";

const record = { token: "tok" } as SessionRecord;

const makeReq = (authorization?: string): AuthedRequest =>
  ({
    header: (name: string) =>
      name.toLowerCase() === "authorization" ? authorization : undefined,
  }) as unknown as AuthedRequest;

const makeRes = () => {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
};

const makeRepo = (found: Maybe<SessionRecord>) =>
  ({ findByToken: vi.fn(() => found) }) as unknown as SessionRepository;

describe("bearerAuth", () => {
  it("attaches the session and calls next for a valid token", () => {
    const req = makeReq("Bearer tok");
    const res = makeRes();
    const next = vi.fn();

    bearerAuth(makeRepo(Just(record)))(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.session).toBe(record);
    expect(res.statusCode).toBe(0);
  });

  it("401s when the Authorization header is missing or wrong scheme", () => {
    const next = vi.fn();
    const repo = makeRepo(Just(record));

    for (const header of [undefined, "", "Basic abc", "tok"]) {
      const res = makeRes();
      bearerAuth(repo)(makeReq(header), res, next);
      expect(res.statusCode).toBe(401);
      expect(res.body).toEqual({ error: "Missing bearer token" });
    }
    expect(next).not.toHaveBeenCalled();
  });

  it("401s when the token is unknown or expired", () => {
    const req = makeReq("Bearer stale");
    const res = makeRes();
    const next = vi.fn();

    bearerAuth(makeRepo(Nothing))(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Invalid or expired session" });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("getSession", () => {
  it("returns the resolved session", () => {
    const req = makeReq();
    req.session = record;
    expect(getSession(req)).toBe(record);
  });

  it("throws when bearerAuth has not run", () => {
    expect(() => getSession(makeReq())).toThrow(
      /bearerAuth middleware missing/,
    );
  });
});
