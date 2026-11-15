import * as React from 'react';

/**
 * Formats inline markdown tokens: **bold**, *italic*, and `code`.
 */
function formatInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-[var(--foreground)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={index} className="italic text-[var(--muted-foreground)]">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="rounded bg-[var(--secondary)] px-1.5 py-0.5 font-mono text-xs text-[var(--foreground)] border border-[var(--border)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/**
 * Parses markdown table blocks into clean styled HTML table elements.
 */
function renderTable(tableLines: string[], key: number): React.ReactNode {
  const firstLine = tableLines[0];
  if (!firstLine || tableLines.length < 2) return null;

  const parseRow = (line: string) =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());

  const headers = parseRow(firstLine);
  const isDivider = (line: string) => line.includes('---');
  const dataLines = tableLines.slice(1).filter((l) => !isDivider(l));

  return (
    <div key={key} className="my-3 overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-[var(--secondary)]/70 text-[var(--foreground)] font-semibold border-b border-[var(--border)]">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3.5 py-2.5 font-semibold">
                {formatInlineMarkdown(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)] bg-[var(--card)]">
          {dataLines.map((rowLine, rIdx) => {
            const cells = parseRow(rowLine);
            return (
              <tr key={rIdx} className="hover:bg-[var(--secondary)]/40 transition-colors">
                {cells.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3.5 py-2 text-[var(--foreground)]">
                    {formatInlineMarkdown(cell)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let currentTable: string[] = [];
  let currentCodeBlock: { language: string; lines: string[] } | null = null;

  const flushList = (key: number) => {
    if (!currentList) return;
    if (currentList.type === 'ul') {
      elements.push(
        <ul
          key={`ul-${key}`}
          className="my-2 space-y-1.5 pl-5 list-disc text-sm text-[var(--foreground)]"
        >
          {currentList.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {formatInlineMarkdown(item)}
            </li>
          ))}
        </ul>,
      );
    } else {
      elements.push(
        <ol
          key={`ol-${key}`}
          className="my-2 space-y-1.5 pl-5 list-decimal text-sm text-[var(--foreground)]"
        >
          {currentList.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {formatInlineMarkdown(item)}
            </li>
          ))}
        </ol>,
      );
    }
    currentList = null;
  };

  const flushTable = (key: number) => {
    if (currentTable.length === 0) return;
    elements.push(renderTable(currentTable, key));
    currentTable = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine === undefined) continue;
    const line = rawLine.trim();

    // Code block toggle (```)
    if (line.startsWith('```')) {
      if (currentCodeBlock) {
        elements.push(
          <div
            key={`code-${i}`}
            className="my-3 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--secondary)]/50 p-3 font-mono text-xs text-[var(--foreground)]"
          >
            <pre>
              <code>{currentCodeBlock.lines.join('\n')}</code>
            </pre>
          </div>,
        );
        currentCodeBlock = null;
      } else {
        flushList(i);
        flushTable(i);
        currentCodeBlock = { language: line.slice(3).trim(), lines: [] };
      }
      continue;
    }

    if (currentCodeBlock) {
      currentCodeBlock.lines.push(rawLine);
      continue;
    }

    // Markdown table line (| ... |)
    if (line.startsWith('|') && line.endsWith('|')) {
      flushList(i);
      currentTable.push(line);
      continue;
    } else {
      flushTable(i);
    }

    // Horizontal rule / divider (--- or *** or ___)
    if (/^(\*\*\*|---|___)$/.test(line)) {
      flushList(i);
      elements.push(<hr key={`hr-${i}`} className="my-3.5 border-t border-[var(--border)]" />);
      continue;
    }

    // Empty line
    if (!line) {
      flushList(i);
      continue;
    }

    // Heading 3 (### Heading)
    if (line.startsWith('### ')) {
      flushList(i);
      elements.push(
        <h3
          key={`h3-${i}`}
          className="mt-3.5 mb-1.5 text-sm font-bold text-[var(--foreground)] tracking-tight"
        >
          {formatInlineMarkdown(line.slice(4).trim())}
        </h3>,
      );
      continue;
    }

    // Heading 2 (## Heading)
    if (line.startsWith('## ')) {
      flushList(i);
      elements.push(
        <h2
          key={`h2-${i}`}
          className="mt-4 mb-2 text-base font-bold text-[var(--foreground)] tracking-tight"
        >
          {formatInlineMarkdown(line.slice(3).trim())}
        </h2>,
      );
      continue;
    }

    // Heading 1 (# Heading)
    if (line.startsWith('# ')) {
      flushList(i);
      elements.push(
        <h1
          key={`h1-${i}`}
          className="mt-4 mb-2 text-lg font-bold text-[var(--foreground)] tracking-tight"
        >
          {formatInlineMarkdown(line.slice(2).trim())}
        </h1>,
      );
      continue;
    }

    // Unordered list item (- or * or •)
    const ulMatch = line.match(/^[-*•]\s+(.*)$/);
    if (ulMatch && ulMatch[1] !== undefined) {
      if (!currentList || currentList.type !== 'ul') {
        flushList(i);
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(ulMatch[1]);
      continue;
    }

    // Ordered list item (1. )
    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch && olMatch[1] !== undefined) {
      if (!currentList || currentList.type !== 'ol') {
        flushList(i);
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(olMatch[1]);
      continue;
    }

    // Regular paragraph
    flushList(i);
    elements.push(
      <p key={`p-${i}`} className="my-1.5 leading-relaxed text-sm text-[var(--foreground)]">
        {formatInlineMarkdown(line)}
      </p>,
    );
  }

  flushList(lines.length);
  flushTable(lines.length);

  return <div className="space-y-0.5">{elements}</div>;
}
