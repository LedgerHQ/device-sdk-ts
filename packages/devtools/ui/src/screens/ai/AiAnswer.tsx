import React from "react";

type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "sequence"; lines: string[] }
  | { kind: "code"; text: string };

type Section = { title: string | null; blocks: Block[] };

const LABEL = "body-4-semi-bold text-muted uppercase";

/** Splits the answer the explain-device-exchange skill asks for: `##` sections, paragraphs, lists and fenced blocks. */
export const parseAnswer = (markdown: string): Section[] => {
  const sections: Section[] = [{ title: null, blocks: [] }];
  const lines = markdown.split("\n");
  let index = 0;
  const current = () => sections[sections.length - 1]!;
  while (index < lines.length) {
    const line = lines[index]!;
    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const body: string[] = [];
      index++;
      while (index < lines.length && !lines[index]!.startsWith("```")) {
        body.push(lines[index]!);
        index++;
      }
      index++;
      current().blocks.push(
        fence[1] === "sequence"
          ? { kind: "sequence", lines: body.filter((l) => l.trim()) }
          : { kind: "code", text: body.join("\n") },
      );
      continue;
    }
    const heading = line.match(/^#{1,4}\s+(.*)/);
    if (heading) {
      sections.push({ title: heading[1]!.trim(), blocks: [] });
    } else if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index]!)) {
        items.push(lines[index]!.replace(/^\s*[-*]\s+/, ""));
        index++;
      }
      current().blocks.push({ kind: "list", items });
      continue;
    } else if (line.trim()) {
      const text: string[] = [line];
      while (
        index + 1 < lines.length &&
        lines[index + 1]!.trim() &&
        !/^(#|```|\s*[-*]\s)/.test(lines[index + 1]!)
      ) {
        index++;
        text.push(lines[index]!);
      }
      current().blocks.push({ kind: "paragraph", text: text.join(" ") });
    }
    index++;
  }
  return sections.filter((s) => s.title !== null || s.blocks.length > 0);
};

const Inline: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s)]+)/).map((part, i) =>
      part.startsWith("http") ? (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="text-active underline"
        >
          {part}
        </a>
      ) : part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : part.startsWith("`") && part.endsWith("`") ? (
        <code key={i} className="font-mono! body-4">
          {part.slice(1, -1)}
        </code>
      ) : (
        part
      ),
    )}
  </>
);

// A status word other than 9000, as the skill writes them on responses
const FAILED_STATUS = /\b(?!9000\b)[5-6][0-9a-f]{3}\b/i;

const SequenceLine: React.FC<{ line: string }> = ({ line }) => {
  const match = line.match(
    /^\s*(App|Device)\s*->\s*(?:App|Device)\s*:\s*(.*)$/i,
  );
  const fromApp = match?.[1]?.toLowerCase() === "app";
  const text = match?.[2] ?? line;
  return (
    <li
      className={`flex gap-8 font-mono! body-4 ${fromApp ? "" : "pl-24"} ${FAILED_STATUS.test(text) && !fromApp ? "text-error" : ""}`}
    >
      <span className="shrink-0 text-muted">
        {fromApp ? "App →" : "← Device"}
      </span>
      <span className="min-w-0 break-words">{text}</span>
    </li>
  );
};

const BlockView: React.FC<{ block: Block }> = ({ block }) => {
  switch (block.kind) {
    case "paragraph":
      return (
        <p className="body-3">
          <Inline text={block.text} />
        </p>
      );
    case "list":
      return (
        <ul className="flex list-disc flex-col gap-4 pl-16 body-3">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      );
    case "sequence":
      return (
        <ol className="flex flex-col gap-4 rounded-sm bg-muted px-12 py-8">
          {block.lines.map((line, i) => (
            <SequenceLine key={i} line={line} />
          ))}
        </ol>
      );
    case "code":
      return (
        <pre className="overflow-x-auto rounded-sm bg-muted px-12 py-8 font-mono! body-4">
          {block.text}
        </pre>
      );
  }
};

export const AiAnswer: React.FC<{ markdown: string }> = ({ markdown }) => (
  <div className="flex flex-col gap-16">
    {parseAnswer(markdown).map((section, i) => {
      const firstText =
        section.blocks[0]?.kind === "paragraph" ? section.blocks[0].text : "";
      const isResult = section.title?.toLowerCase() === "result";
      const failed = /^\**failed/i.test(firstText);
      return (
        <section
          key={i}
          className={`flex flex-col gap-8 ${isResult ? "rounded-sm bg-muted px-12 py-10" : ""}`}
        >
          {section.title && (
            <h3 className={`flex items-center gap-8 ${LABEL}`}>
              {isResult && (
                <span
                  className={`size-8 rounded-full ${failed ? "bg-(--color-light-red-500)" : "bg-(--color-light-green-500)"}`}
                />
              )}
              {section.title}
            </h3>
          )}
          {section.blocks.map((block, j) => (
            <BlockView key={j} block={block} />
          ))}
        </section>
      );
    })}
  </div>
);
