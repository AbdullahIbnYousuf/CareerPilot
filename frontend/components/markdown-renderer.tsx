"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

// ── Helpers ─────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors duration-150 px-2 py-1 rounded-md hover:bg-white/[0.05]"
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

// ── Inline markdown within a single text run ────────────────────────────────

function InlineMarkdown({ text }: { text: string }) {
  // Process bold (**text**), inline code (`code`), and plain text
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[0].startsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-semibold text-white">
          {match[2]}
        </strong>
      );
    } else if (match[0].startsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="bg-white/[0.08] text-[#AFA9EC] px-1.5 py-0.5 rounded text-[0.8em] font-mono"
        >
          {match[3]}
        </code>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <>{parts}</>;
}

// ── Main MarkdownRenderer ───────────────────────────────────────────────────

interface MarkdownRendererProps {
  content: string;
  /** Pass true while the LLM is still streaming so code blocks stay open. */
  isStreaming?: boolean;
}

export function MarkdownRenderer({
  content,
  isStreaming = false,
}: MarkdownRendererProps) {
  // Split on fenced code blocks (``` ... ```)
  const parts = content.split(/(```[\s\S]*?```|```[\s\S]*$)/g);

  const elements: React.ReactNode[] = [];

  parts.forEach((part, idx) => {
    // ── Code block ───────────────────────────────────────────────────────
    if (part.startsWith("```")) {
      const firstNewline = part.indexOf("\n");
      const lang =
        firstNewline > 3 ? part.slice(3, firstNewline).trim() : "";
      const isOpen = !part.trimEnd().endsWith("```") || isStreaming;
      const code = isOpen
        ? part.slice(firstNewline + 1)
        : part.slice(firstNewline + 1, part.lastIndexOf("```")).trim();

      elements.push(
        <div
          key={idx}
          className="my-3 rounded-xl overflow-hidden border border-white/[0.07] bg-[#08080C]"
        >
          <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/[0.05]">
            <span className="text-xs font-mono text-white/30">
              {lang || "text"}
            </span>
            <CopyButton text={code} />
          </div>
          <pre className="px-4 py-3 text-sm font-mono text-white/80 overflow-x-auto leading-relaxed whitespace-pre-wrap break-words">
            <code>{code}</code>
          </pre>
        </div>
      );
      return;
    }

    // ── Text block — render line by line ─────────────────────────────────
    const lines = part.split("\n");
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Heading
      const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2];
        const className =
          level === 1
            ? "text-lg font-bold text-white mt-4 mb-1"
            : level === 2
            ? "text-base font-semibold text-white mt-3 mb-1"
            : "text-sm font-semibold text-white/90 mt-2 mb-0.5";
        elements.push(
          <p key={`${idx}-h-${i}`} className={className}>
            <InlineMarkdown text={text} />
          </p>
        );
        i++;
        continue;
      }

      // Bullet list — collect consecutive bullets
      if (line.match(/^[-*]\s+/)) {
        const bullets: string[] = [];
        while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
          bullets.push(lines[i].replace(/^[-*]\s+/, ""));
          i++;
        }
        elements.push(
          <ul key={`${idx}-ul-${i}`} className="my-2 space-y-1 pl-1">
            {bullets.map((b, bi) => (
              <li key={bi} className="flex items-start gap-2 text-white/80">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#AFA9EC]/60" />
                <InlineMarkdown text={b} />
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // Numbered list — collect consecutive numbered items
      if (line.match(/^\d+\.\s+/)) {
        const items: string[] = [];
        let startNum = i;
        while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
          items.push(lines[i].replace(/^\d+\.\s+/, ""));
          i++;
        }
        elements.push(
          <ol
            key={`${idx}-ol-${startNum}`}
            className="my-2 space-y-1 pl-1 list-none"
          >
            {items.map((item, ii) => (
              <li key={ii} className="flex items-start gap-2.5 text-white/80">
                <span className="mt-0.5 min-w-[1.25rem] text-xs font-mono text-[#AFA9EC]/60 text-right">
                  {ii + 1}.
                </span>
                <InlineMarkdown text={item} />
              </li>
            ))}
          </ol>
        );
        continue;
      }

      // Horizontal rule
      if (line.match(/^---+$/)) {
        elements.push(
          <hr key={`${idx}-hr-${i}`} className="my-3 border-white/[0.07]" />
        );
        i++;
        continue;
      }

      // Empty line — just a small gap
      if (line.trim() === "") {
        elements.push(<div key={`${idx}-br-${i}`} className="h-2" />);
        i++;
        continue;
      }

      // Regular paragraph
      elements.push(
        <p key={`${idx}-p-${i}`} className="text-white/85 leading-relaxed">
          <InlineMarkdown text={line} />
        </p>
      );
      i++;
    }
  });

  return <div className="space-y-0.5 text-sm">{elements}</div>;
}
