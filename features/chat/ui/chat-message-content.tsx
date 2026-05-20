'use client';

import DOMPurify from 'isomorphic-dompurify';
import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { TaskTable } from '@/entities/artifact';

import type { TaskTableArtifact } from '@/entities/artifact';

// Module-level constant — prevents array recreation on every render
const REMARK_PLUGINS = [remarkGfm];

type Segment =
  | { type: 'text'; content: string }
  | { type: 'tasks'; tasks: TaskTableArtifact['data']['tasks'] };

function splitTaskBlocks(content: string): Segment[] {
  const segments: Segment[] = [];
  const pattern = /```json\r?\n([\s\S]*?)\r?\n```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: content.slice(lastIndex, match.index),
      });
    }
    try {
      const parsed: unknown = JSON.parse(match[1]);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        typeof parsed[0] === 'object' &&
        parsed[0] !== null &&
        'title' in parsed[0]
      ) {
        segments.push({
          type: 'tasks',
          tasks: parsed as TaskTableArtifact['data']['tasks'],
        });
        lastIndex = match.index + match[0].length;
        continue;
      }
    } catch {
      // not valid JSON — fall through to text
    }
    segments.push({ type: 'text', content: match[0] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return segments;
}

interface ChatMessageContentProps {
  content: string;
}

/**
 * Renders AI message content.
 *
 * - Plain text / markdown → react-markdown (handles \n, lists, bold, tables, code, etc.)
 * - Raw HTML (starts with "<") → innerHTML + script re-execution (Chart.js, canvas, etc.)
 * @param root0 - Component props.
 * @param root0.content - The raw message content string to render.
 * @returns Result.
 */
export function ChatMessageContent({ content }: ChatMessageContentProps) {
  const isHtml = content.trimStart().startsWith('<');

  if (!isHtml) {
    const segments = splitTaskBlocks(content);

    if (segments.length === 1 && segments[0].type === 'text') {
      return (
        <div className='chat-html-content'>
          <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
            {content}
          </ReactMarkdown>
        </div>
      );
    }

    return (
      <div className='chat-html-content flex flex-col gap-3'>
        {segments.map((seg, i) => {
          return seg.type === 'tasks' ? (
            <TaskTable
              key={`tasks-${i}-${seg.tasks.length}`}
              data={{ tasks: seg.tasks }}
            />
          ) : (
            <ReactMarkdown
              key={`text-${seg.content.slice(0, 32)}`}
              remarkPlugins={REMARK_PLUGINS}
            >
              {seg.content}
            </ReactMarkdown>
          );
        })}
      </div>
    );
  }

  return <HtmlContent content={content} />;
}

/**
 * HtmlContent component.
 * Sanitizes AI-generated HTML with DOMPurify before injection to prevent XSS.
 * Script tags are intentionally stripped — AI HTML output must not execute code.
 * @param props - Component props.
 * @param props.content - Raw HTML string from AI to sanitize and render.
 * @returns Result.
 */
function HtmlContent({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    ref.current.innerHTML = DOMPurify.sanitize(content, { FORCE_BODY: true });
  }, [content]);

  return <div ref={ref} className='chat-html-content' />;
}
