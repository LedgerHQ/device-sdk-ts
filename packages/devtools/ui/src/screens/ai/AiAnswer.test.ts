import { parseAnswer } from "./AiAnswer";

describe("parseAnswer", () => {
  it("splits sections, paragraphs, lists and the sequence block", () => {
    const sections = parseAnswer(
      [
        "## What happened",
        "The app signed",
        "a transaction.",
        "",
        "## Sequence",
        "```sequence",
        "App -> Device: signTransaction",
        "",
        "Device -> App: 6985",
        "```",
        "## Try next",
        "- Retry",
        "- Check the device",
      ].join("\n"),
    );
    expect(sections).toEqual([
      {
        title: "What happened",
        blocks: [{ kind: "paragraph", text: "The app signed a transaction." }],
      },
      {
        title: "Sequence",
        blocks: [
          {
            kind: "sequence",
            lines: ["App -> Device: signTransaction", "Device -> App: 6985"],
          },
        ],
      },
      {
        title: "Try next",
        blocks: [{ kind: "list", items: ["Retry", "Check the device"] }],
      },
    ]);
  });

  it("keeps text before the first heading and other code blocks", () => {
    expect(parseAnswer("Intro\n```\nraw\n```")).toEqual([
      {
        title: null,
        blocks: [
          { kind: "paragraph", text: "Intro" },
          { kind: "code", text: "raw" },
        ],
      },
    ]);
  });
});
