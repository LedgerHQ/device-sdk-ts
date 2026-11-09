import { redact, redactRequest } from "./redact";

describe("redact", () => {
  it("replaces every shared session token", () => {
    expect(redact("old tok-A then tok-B", ["tok-A", "tok-B"])).toBe(
      "old <redacted> then <redacted>",
    );
  });

  it("redacts credential-looking fields", () => {
    expect(redact('{"sessionToken":"abc","apiKey":"k"}', [])).toBe(
      '{"sessionToken":"<redacted>","apiKey":"<redacted>"}',
    );
    expect(redact("GET http://h/#token=zz&x=1", [])).toBe(
      "GET http://h/#token=<redacted>&x=1",
    );
    expect(redact("Authorization: Bearer abc.def", [])).not.toContain(
      "abc.def",
    );
    expect(redact("password=hunter2", [])).toBe("password=<redacted>");
  });

  it("redacts the whole quoted value, whatever it holds", () => {
    expect(redact('{"password":"correct horse, battery staple"}', [])).toBe(
      '{"password":"<redacted>"}',
    );
    expect(redact('{"sessionToken":"ab\\"cd ef"}', [])).toBe(
      '{"sessionToken":"<redacted>"}',
    );
    expect(redact("token='a b c' next", [])).toBe("token='<redacted>' next");
  });

  it("redacts quoted values in escaped JSON, as logs print it", () => {
    expect(
      redact('{\\"apiKey\\":\\"k 1, 2\\",\\"url\\":\\"http://h\\"}', []),
    ).toBe('{\\"apiKey\\":\\"<redacted>\\",\\"url\\":\\"http://h\\"}');
  });

  it("redacts Authorization headers whatever their scheme", () => {
    expect(redact("Authorization: Basic dXNlcjp0ZXN0", [])).toBe(
      "Authorization: <redacted>",
    );
    expect(redact('"authorization": "Basic dXNlcjp0ZXN0"', [])).toBe(
      '"authorization": "<redacted>"',
    );
    expect(redact("sent basic dXNlcjp0ZXN0 here", [])).toBe(
      "sent basic <redacted> here",
    );
  });

  it("recognises credential keys in camelCase and snake_case", () => {
    expect(redact('{"access_token":"a b","refreshToken":"r"}', [])).toBe(
      '{"access_token":"<redacted>","refreshToken":"<redacted>"}',
    );
    expect(redact("clientSecret=s1 privateKey: 0xab", [])).toBe(
      "clientSecret=<redacted> privateKey: <redacted>",
    );
    expect(
      redact('{"seed":"abandon abandon","mnemonic":"word word"}', []),
    ).toBe('{"seed":"<redacted>","mnemonic":"<redacted>"}');
    expect(redact("seedPhrase=x passphrase=y", [])).toBe(
      "seedPhrase=<redacted> passphrase=<redacted>",
    );
  });

  it("leaves public values alone", () => {
    expect(redact("publicKey=0x04ab sessionId=abc", [])).toBe(
      "publicKey=0x04ab sessionId=abc",
    );
  });

  it("leaves ordinary words alone", () => {
    expect(redact("the basic flow worked", [])).toBe("the basic flow worked");
  });

  it("leaves APDUs alone", () => {
    expect(redact("=> e004000020 <= 6985", [])).toBe("=> e004000020 <= 6985");
  });
});

describe("redactRequest", () => {
  it("redacts the selection of an explanation", () => {
    expect(
      redactRequest(
        {
          kind: "explain",
          context: "token=t1",
          summary: "1 log",
          readCode: false,
        },
        [],
      ),
    ).toEqual({
      kind: "explain",
      context: "token=<redacted>",
      summary: "1 log",
      readCode: false,
    });
  });

  it("redacts a follow-up question", () => {
    expect(
      redactRequest(
        {
          kind: "followUp",
          sessionId: "s",
          question: "why tok-A?",
          readCode: false,
        },
        ["tok-A"],
      ),
    ).toMatchObject({ question: "why <redacted>?" });
  });

  it("leaves a ticket request unchanged", () => {
    const request = { kind: "createTicket" as const, sessionId: "s" };
    expect(redactRequest(request, ["s"])).toBe(request);
  });
});
