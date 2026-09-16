"use client";

import type { ReactNode } from "react";

const MENTION_PATTERN = /@([A-Za-z0-9._-]+)/g;

type MentionTextProps = {
    text: string;
    className?: string;
};

function renderLineWithMentions(line: string, keyPrefix: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    let cursor = 0;
    let match: RegExpExecArray | null;
    MENTION_PATTERN.lastIndex = 0;
    while ((match = MENTION_PATTERN.exec(line)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (start > cursor) {
            nodes.push(
                <span key={`${keyPrefix}-text-${cursor}`}>{line.slice(cursor, start)}</span>
            );
        }
        nodes.push(
            <span
                key={`${keyPrefix}-mention-${start}`}
                className="rounded bg-indigo-100 px-1 py-0.5 font-medium text-indigo-700"
            >
        {match[0]}
      </span>
        );
        cursor = end;
    }
    if (cursor < line.length) {
        nodes.push(<span key={`${keyPrefix}-tail-${cursor}`}>{line.slice(cursor)}</span>);
    }
    return nodes;
}

export function MentionText({ text, className }: MentionTextProps) {
    const lines = text.split(/\r?\n/);
    return (
        <span className={className}>
      {lines.map((line, index) => (
          <span key={`line-${index}`}>
          {renderLineWithMentions(line, `line-${index}`)}
              {index < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </span>
    );
}
