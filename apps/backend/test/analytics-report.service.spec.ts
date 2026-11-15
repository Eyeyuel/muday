import { describe, expect, it } from 'vitest';

import { AnalyticsReportService } from '../src/analytics/analytics-report.service.js';
import type { PrismaService } from '../src/database/prisma.service.js';

describe('AnalyticsReportService', () => {
  it('is zero-safe when the database has no measurable users or events', async () => {
    const prisma = {
      event: { findMany: () => Promise.resolve([]) },
      user: { findMany: () => Promise.resolve([]) },
      transactionGroup: { findMany: () => Promise.resolve([]) },
      transaction: { findMany: () => Promise.resolve([]) },
      pendingInteraction: { findMany: () => Promise.resolve([]) },
    } as unknown as PrismaService;
    const report = await new AnalyticsReportService(prisma).generate(
      new Date('2026-08-04T12:00:00.000Z'),
    );
    expect(report.acquisition.consentConversion).toEqual({
      numerator: 0,
      denominator: 0,
      percentage: '0.00',
    });
    expect(report.activeUsers).toEqual({ dau: 0, wau: 0, mau: 0 });
    expect(report.retention.d7.percentage).toBe('0.00');
    expect(report.retention.d30.percentage).toBe('0.00');
  });

  it('counts an unresolved clarification as a measurable logging attempt', async () => {
    const prisma = {
      event: {
        findMany: () =>
          Promise.resolve([
            {
              userId: 'user',
              eventType: 'clarification_requested',
              metadata: { source: 'text', reason: 'clarify_amount' },
              occurredAt: new Date('2026-08-04T08:00:00.000Z'),
            },
          ]),
      },
      user: { findMany: () => Promise.resolve([]) },
      transactionGroup: { findMany: () => Promise.resolve([]) },
      transaction: { findMany: () => Promise.resolve([]) },
      pendingInteraction: { findMany: () => Promise.resolve([]) },
    } as unknown as PrismaService;
    const report = await new AnalyticsReportService(prisma).generate(
      new Date('2026-08-04T12:00:00.000Z'),
    );
    expect(report.clarifications.measurableAttempts).toBe(1);
    expect(report.clarifications.requestRate.percentage).toBe('100.00');
  });

  it('keeps confirmed receipt transactions separate from text metrics', async () => {
    const prisma = {
      event: {
        findMany: () =>
          Promise.resolve([
            {
              userId: 'user',
              eventType: 'transaction_logged',
              metadata: { source: 'receipt', transactionCount: 1 },
              occurredAt: new Date('2026-08-04T08:00:00.000Z'),
            },
          ]),
      },
      user: { findMany: () => Promise.resolve([]) },
      transactionGroup: { findMany: () => Promise.resolve([]) },
      transaction: { findMany: () => Promise.resolve([]) },
      pendingInteraction: { findMany: () => Promise.resolve([]) },
    } as unknown as PrismaService;
    const report = await new AnalyticsReportService(prisma).generate(
      new Date('2026-08-04T12:00:00.000Z'),
    );
    expect(report.transactions.receiptGroups).toBe(1);
    expect(report.transactions.receiptTransactions).toBe(1);
    expect(report.transactions.textGroups).toBe(0);
  });

  it('reports only privacy-safe classification quality counts', async () => {
    const now = new Date('2026-08-04T08:00:00.000Z');
    const prisma = {
      event: {
        findMany: () =>
          Promise.resolve([
            {
              userId: 'user',
              eventType: 'transaction_logged',
              metadata: {
                source: 'text',
                transactionCount: 3,
                kindCounts: { expense: 1, loan_received: 1, refund: 1 },
                otherCount: 1,
              },
              occurredAt: now,
            },
            {
              userId: 'user',
              eventType: 'transfer_rejected',
              metadata: { source: 'text', count: 2 },
              occurredAt: now,
            },
            {
              userId: 'user',
              eventType: 'confirmation_cancelled',
              metadata: { source: 'receipt', confirmation: 'receipt' },
              occurredAt: now,
            },
            {
              userId: 'user',
              eventType: 'extraction_invalid_output',
              metadata: { source: 'voice', provider: 'gemini' },
              occurredAt: now,
            },
          ]),
      },
      user: { findMany: () => Promise.resolve([]) },
      transactionGroup: { findMany: () => Promise.resolve([]) },
      transaction: { findMany: () => Promise.resolve([]) },
      pendingInteraction: { findMany: () => Promise.resolve([]) },
    } as unknown as PrismaService;
    const report = await new AnalyticsReportService(prisma).generate(
      new Date('2026-08-04T12:00:00.000Z'),
    );
    expect(report.transactions.byKind).toEqual({ expense: 1, loan_received: 1, refund: 1 });
    expect(report.transactions.otherRate).toEqual({
      numerator: 1,
      denominator: 3,
      percentage: '33.33',
    });
    expect(report.extractionQuality).toEqual({
      rejectedTransfers: 2,
      cancelledConfirmations: 1,
      geminiInvalidOutputs: 1,
    });
    expect(JSON.stringify(report.extractionQuality)).not.toContain('amount');
    expect(JSON.stringify(report.extractionQuality)).not.toContain('note');
    expect(JSON.stringify(report.transactions)).not.toContain('amount');
    expect(JSON.stringify(report.transactions)).not.toContain('note');
  });
});
