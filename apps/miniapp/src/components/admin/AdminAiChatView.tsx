import * as React from 'react';
import {
  AlertCircle,
  Bot,
  CreditCard,
  Database,
  FileSpreadsheet,
  FileText,
  PieChart,
  Plus,
  Send,
  UserCheck,
} from 'lucide-react';
import {
  sendAdminAiMessage,
  exportAdminAiDirect,
  downloadAdminAiExportFile,
} from '../../api/admin-api';
import type { AdminAiChatMessage } from '../../api/admin-types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  ChatBubble,
  ChatBubbleAction,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from '../ui/chat/chat-bubble';
import { ChatInput } from '../ui/chat/chat-input';
import { ChatMessageList } from '../ui/chat/chat-message-list';
import { AiThinkingLoader } from './AiThinkingLoader';
import { TypewriterMessage } from './TypewriterMessage';
import { ChatFileAttachmentCard } from './ChatFileAttachmentCard';
import { cn } from '@/lib/utils';

const SUGGESTED_PROMPTS = [
  {
    icon: PieChart,
    label: 'Top Categories',
    prompt: 'What are the top spending categories in Muday?',
  },
  {
    icon: CreditCard,
    label: 'Telebirr vs CBE',
    prompt: 'Compare payment volume between Telebirr and CBE',
  },
  {
    icon: UserCheck,
    label: 'Top Spender Audit',
    prompt: 'Who is our highest spending user and what did they buy?',
  },
  {
    icon: FileSpreadsheet,
    label: 'Generate Excel Sheet',
    prompt: 'Generate an Excel spreadsheet of our top spending categories and volume share',
  },
];

export function AdminAiChatView() {
  const [messages, setMessages] = React.useState<AdminAiChatMessage[]>([]);
  const [sessionId, setSessionId] = React.useState<string | undefined>(undefined);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [exportingId, setExportingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [animatingId, setAnimatingId] = React.useState<string | null>(null);

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText ?? input).trim();
    if (!textToSend || isLoading) return;

    setError(null);
    setInput('');

    const userMessage: AdminAiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await sendAdminAiMessage(textToSend, sessionId);
      setSessionId(response.sessionId);

      const assistantMessage: AdminAiChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        toolsExecuted: response.toolsExecuted,
        visualData: response.visualData,
        fileAttachment: response.visualData?.fileAttachment,
        timestamp: new Date().toISOString(),
      };

      setAnimatingId(assistantMessage.id);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Failed to communicate with AI Assistant. Please check your network and try again.';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const parseMarkdownTable = (
    content: string,
  ): { headers: string[]; rows: (string | number)[][] } | null => {
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('|') && l.endsWith('|'));
    if (lines.length < 3) return null;

    const parseRow = (line: string) =>
      line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
    const headerLine = lines[0];
    if (!headerLine) return null;
    const headers = parseRow(headerLine);
    // Skip separator row (line 1, e.g. |---|---|)
    const dataLines = lines.slice(2);
    const rows = dataLines.map((line) => parseRow(line));
    return { headers, rows };
  };

  const handleExport = async (msg: AdminAiChatMessage, format: 'EXCEL' | 'WORD') => {
    const exportKey = `${msg.id}-${format}`;
    setExportingId(exportKey);
    try {
      let headers = msg.visualData?.table?.headers;
      let rows = msg.visualData?.table?.rows;

      if (!rows || rows.length === 0) {
        const parsed = parseMarkdownTable(msg.content);
        if (parsed) {
          headers = parsed.headers;
          rows = parsed.rows;
        } else {
          headers = ['Metric / Insight Item', 'Details'];
          rows = [
            ['Analysis Scope', 'Muday Executive Financial Intelligence'],
            ['Summary Content', msg.content.slice(0, 300)],
          ];
        }
      }

      const kpis = msg.visualData?.kpis?.map((k) => ({ label: k.label, value: k.value }));

      const res = await exportAdminAiDirect({
        format,
        title: msg.visualData?.table?.title || 'Muday_Financial_Analysis',
        headers: headers ?? ['Item', 'Value'],
        rows: rows ?? [],
        kpis,
        summary: msg.content.slice(0, 600),
      });

      await downloadAdminAiExportFile(res.downloadUrl, res.filename);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      setError(msg);
      console.error('Export failed:', err);
    } finally {
      setExportingId(null);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(undefined);
    setError(null);
    setInput('');
    setAnimatingId(null);
    setExportingId(null);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--background)]">
      {/* 1. Header Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[var(--foreground)]">
                Muday AI Data Assistant
              </h1>
              <Badge variant="secondary" className="gap-1.5 text-[10px] font-medium tracking-wide">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                GEMINI 3.6 FLASH
              </Badge>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              Conversational intelligence and database analytics
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleNewChat}
          className="gap-1.5 text-xs font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          New Analysis
        </Button>
      </div>

      {/* 2. Message Thread or Empty Hero */}
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] shadow-inner mb-4">
            <Bot className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-[var(--foreground)] mb-1">
            How can I help explore Muday data today?
          </h2>
          <p className="max-w-md text-xs text-[var(--muted-foreground)] mb-6 leading-relaxed">
            Ask any question about consumer spending habits, bank distributions (Telebirr, CBE,
            Cash), user behavior, or platform metrics.
          </p>

          <div className="grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
            {SUGGESTED_PROMPTS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => void handleSend(item.prompt)}
                  className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-left transition-all hover:border-[var(--primary)] hover:bg-[var(--secondary)] hover:shadow-xs group cursor-pointer"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)] text-[var(--foreground)] group-hover:bg-[var(--primary)] group-hover:text-[var(--primary-foreground)] transition-colors">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[var(--foreground)]">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-[var(--muted-foreground)] line-clamp-1">
                      {item.prompt}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <ChatMessageList className="flex-1">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <ChatBubble key={msg.id} variant={isUser ? 'sent' : 'received'} className="group">
                <ChatBubbleAvatar variant={isUser ? 'sent' : 'received'} />
                <div
                  className={cn(
                    'flex flex-col gap-1 max-w-[85%] sm:max-w-[75%]',
                    isUser ? 'items-end' : 'items-start',
                  )}
                >
                  {/* Tool execution badge for assistant */}
                  {!isUser && msg.toolsExecuted && msg.toolsExecuted.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {msg.toolsExecuted.map((tool, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="gap-1.5 text-[10px] font-normal py-0.5 px-2 bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)]"
                        >
                          <Database className="h-3 w-3 text-[var(--primary)] shrink-0" />
                          Queried {tool.toolName}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <div
                    className={cn(
                      'flex items-center gap-1.5 w-full',
                      isUser ? 'justify-end' : 'justify-start',
                    )}
                  >
                    <ChatBubbleMessage variant={isUser ? 'sent' : 'received'}>
                      {isUser ? (
                        msg.content
                      ) : (
                        <TypewriterMessage
                          content={msg.content}
                          animate={animatingId === msg.id}
                          onComplete={() => setAnimatingId(null)}
                        />
                      )}
                    </ChatBubbleMessage>

                    {!isUser ? <ChatBubbleAction contentToCopy={msg.content} /> : null}
                  </div>

                  {/* Inline File Attachment Card from Conversational Tool */}
                  {!isUser && msg.fileAttachment ? (
                    <div className="w-full">
                      <ChatFileAttachmentCard attachment={msg.fileAttachment} />
                    </div>
                  ) : null}

                  {/* 1-Click Universal Export Actions for Any AI Analysis Message */}
                  {!isUser && !msg.fileAttachment ? (
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 pt-1.5 border-t border-[var(--border-hairline)] w-full">
                      <span className="text-[10px] font-semibold text-[var(--slate-gray)]">
                        Export Analysis:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void handleExport(msg, 'EXCEL');
                        }}
                        disabled={exportingId === `${msg.id}-EXCEL`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-500/20 transition-colors cursor-pointer shadow-2xs"
                      >
                        <FileSpreadsheet className="size-3.5" />
                        <span>
                          {exportingId === `${msg.id}-EXCEL` ? 'Generating...' : 'Excel (.xlsx)'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleExport(msg, 'WORD');
                        }}
                        disabled={exportingId === `${msg.id}-WORD`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-500/20 transition-colors cursor-pointer shadow-2xs"
                      >
                        <FileText className="size-3.5" />
                        <span>
                          {exportingId === `${msg.id}-WORD` ? 'Generating...' : 'Word (.docx)'}
                        </span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </ChatBubble>
            );
          })}

          {isLoading ? (
            <ChatBubble variant="received">
              <ChatBubbleAvatar variant="received" />
              <AiThinkingLoader />
            </ChatBubble>
          ) : null}
        </ChatMessageList>
      )}

      {/* 3. Error Banner */}
      {error ? (
        <div className="mx-4 mb-2 flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-600 dark:text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="h-6 px-2 text-xs"
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      {/* 4. Bottom Input Bar */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
        {messages.length > 0 ? (
          <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {SUGGESTED_PROMPTS.map((item, idx) => (
              <Button
                key={idx}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleSend(item.prompt)}
                disabled={isLoading}
                className="h-7 shrink-0 rounded-lg text-[11px] font-normal"
              >
                {item.label}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <ChatInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onEnterSubmit={() => void handleSend()}
              disabled={isLoading}
              placeholder="Ask about spending habits, banks, users, or platform stats..."
            />
          </div>

          <Button
            type="button"
            size="icon"
            onClick={() => void handleSend()}
            disabled={!input.trim() || isLoading}
            className="h-[44px] w-[44px] shrink-0 rounded-xl"
            title="Send inquiry (Enter)"
            aria-label="Send inquiry"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-1.5 text-center text-[10px] text-[var(--muted-foreground)]">
          Press{' '}
          <kbd className="rounded border border-[var(--border)] px-1 py-0.5 font-mono">Enter</kbd>{' '}
          to send,{' '}
          <kbd className="rounded border border-[var(--border)] px-1 py-0.5 font-mono">
            Shift + Enter
          </kbd>{' '}
          for new line
        </div>
      </div>
    </div>
  );
}
