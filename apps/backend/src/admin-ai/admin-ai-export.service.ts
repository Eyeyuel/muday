import { Injectable, Logger } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  Header,
  Footer,
  PageNumber,
} from 'docx';
import { randomUUID } from 'node:crypto';

export interface ExportReportData {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  kpis?: Array<{ label: string; value: string }>;
  summary?: string;
}

interface CachedExportFile {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  expiresAt: number;
}

const DISPLAY_DICTIONARY: Record<string, string> = {
  clothing_personal_care: 'Clothing & Personal Care',
  clothing: 'Clothing & Personal Care',
  food_groceries: 'Food & Groceries',
  food: 'Food & Groceries',
  groceries: 'Food & Groceries',
  housing_rent: 'Housing & Rent',
  rent: 'Housing & Rent',
  airtime_data: 'Airtime & Internet',
  airtime_internet: 'Airtime & Internet',
  airtime: 'Airtime & Internet',
  utilities: 'Utilities & Bills',
  health: 'Healthcare & Medical',
  healthcare: 'Healthcare & Medical',
  education: 'Education & Tuition',
  family_support: 'Family Support',
  entertainment: 'Entertainment & Dining',
  entertainment_dining: 'Entertainment & Dining',
  church_charity: 'Church & Charity',
  church_charity_gifts: 'Church & Charity',
  transport: 'Transportation & Travel',
  transportation: 'Transportation & Travel',
  travel: 'Transportation & Travel',
  shopping: 'Shopping & Household',
  shopping_household: 'Shopping & Household',
  fees_taxes: 'Fees & Taxes',
  salary: 'Salary & Wages',
  business: 'Business Income',
  remittance: 'Remittance',
  other_income: 'Other Income',
  other_expense: 'Other Expense',
  other: 'Other Expense',
  loan_received: 'Loan Received',
  loan_repayment: 'Loan Repayment',
  debt_repayment: 'Loan Repayment',
  refund: 'Refund',
  reimbursement: 'Reimbursement',
  transfer: 'Self Transfer',
  own_transfer: 'Self Transfer',
  voice: 'Voice Note',
  receipt: 'Receipt Scan',
  text: 'Manual Text',
  sms: 'Bank SMS',
  telebirr: 'Telebirr',
  cbe: 'CBE',
  cbe_birr: 'CBE Birr',
  cbebirr: 'CBE Birr',
  boa: 'Bank of Abyssinia',
  abyssinia: 'Bank of Abyssinia',
  awash: 'Awash Bank',
  dashen: 'Dashen Bank',
  cash: 'Cash',
  expense: 'Expense',
  income: 'Income',
  active: 'Active',
  pending_consent: 'Pending Consent',
  confirmed: 'Confirmed',
};

/**
 * Humanizes database snake_case strings and categories into clean corporate Title Case.
 */
export function humanizeValue(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (!trimmed) return trimmed;

  // Direct dictionary lookup (case-insensitive)
  const lowerKey = trimmed.toLowerCase();
  if (DISPLAY_DICTIONARY[lowerKey]) {
    return DISPLAY_DICTIONARY[lowerKey];
  }

  // Preserve pre-formatted currencies ("4,000.00 ETB"), percentages ("40.5%"), dates ("2026-08-15"), or normal multi-word sentences
  if (trimmed.includes(' ') && !trimmed.includes('_')) {
    return trimmed;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed;
  }

  // Convert snake_case or hyphenated string to Title Case
  if (trimmed.includes('_') || trimmed.includes('-')) {
    return trimmed
      .replace(/[-_]+/g, ' ')
      .split(' ')
      .map((word) => {
        const wLower = word.toLowerCase();
        if (DISPLAY_DICTIONARY[wLower]) return DISPLAY_DICTIONARY[wLower];
        if (wLower === 'and') return '&';
        if (wLower === 'etb') return 'ETB';
        if (wLower === 'cbe') return 'CBE';
        if (wLower === 'sms') return 'SMS';
        if (wLower === 'ai') return 'AI';
        if (wLower === 'kpi') return 'KPI';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  // If single lowercase word (e.g. "transport", "food")
  if (/^[a-z]+$/.test(trimmed)) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  return trimmed;
}

@Injectable()
export class AdminAiExportService {
  private readonly logger = new Logger(AdminAiExportService.name);
  private readonly fileCache = new Map<string, CachedExportFile>();

  constructor() {
    // Periodically clean up expired cached files every 5 minutes
    setInterval(
      () => {
        const now = Date.now();
        for (const [token, file] of this.fileCache.entries()) {
          if (file.expiresAt < now) {
            this.fileCache.delete(token);
          }
        }
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Generates a fully styled Microsoft Excel (.xlsx) workbook using Muday Mint Brand styling.
   */
  async generateExcel(data: ExportReportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Muday Admin AI Assistant';
    workbook.lastModifiedBy = 'Muday Platform';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet('Executive Report', {
      views: [{ showGridLines: true }],
    });

    let currentRow = 1;

    // 1. Muday Brand Header Banner (Deep Emerald Green #047857)
    sheet.mergeCells(`A${currentRow}:F${currentRow}`);
    const titleCell = sheet.getCell(`A${currentRow}`);
    titleCell.value = data.title.toUpperCase();
    titleCell.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF047857' }, // Deep Muday Emerald
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(currentRow).height = 36;
    currentRow += 1;

    // Subtitle & Generated Info (Soft Mint Tint #F0FDF4)
    sheet.mergeCells(`A${currentRow}:F${currentRow}`);
    const subCell = sheet.getCell(`A${currentRow}`);
    subCell.value = `${data.subtitle ?? 'Muday Financial Intelligence & Consumer Analytics'} | Generated on ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })} EAT`;
    subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF065F46' } };
    subCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0FDF4' }, // Soft Mint
    };
    subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(currentRow).height = 20;
    currentRow += 2;

    // 2. KPI Summary Cards (if provided)
    if (data.kpis && data.kpis.length > 0) {
      data.kpis.forEach((kpi, idx) => {
        const colLetter = String.fromCharCode(65 + idx * 2); // A, C, E...
        const nextCol = String.fromCharCode(65 + idx * 2 + 1);
        sheet.mergeCells(`${colLetter}${currentRow}:${nextCol}${currentRow}`);
        sheet.mergeCells(`${colLetter}${currentRow + 1}:${nextCol}${currentRow + 1}`);

        const labelCell = sheet.getCell(`${colLetter}${currentRow}`);
        labelCell.value = String(humanizeValue(kpi.label)).toUpperCase();
        labelCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF047857' } };
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
        labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
        labelCell.border = {
          top: { style: 'thin', color: { argb: 'FFA7F3D0' } },
          left: { style: 'thin', color: { argb: 'FFA7F3D0' } },
          right: { style: 'thin', color: { argb: 'FFA7F3D0' } },
        };

        const valCell = sheet.getCell(`${colLetter}${currentRow + 1}`);
        valCell.value = String(humanizeValue(kpi.value));
        valCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF064E3B' } };
        valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
        valCell.alignment = { horizontal: 'center', vertical: 'middle' };
        valCell.border = {
          bottom: { style: 'thin', color: { argb: 'FFA7F3D0' } },
          left: { style: 'thin', color: { argb: 'FFA7F3D0' } },
          right: { style: 'thin', color: { argb: 'FFA7F3D0' } },
        };
      });
      currentRow += 3;
    }

    // 3. Executive AI Summary (if provided)
    if (data.summary) {
      sheet.mergeCells(`A${currentRow}:F${currentRow}`);
      const sumHeader = sheet.getCell(`A${currentRow}`);
      sumHeader.value = 'EXECUTIVE SUMMARY & AI INSIGHTS';
      sumHeader.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF047857' } };
      currentRow += 1;

      sheet.mergeCells(`A${currentRow}:F${currentRow + 1}`);
      const sumBody = sheet.getCell(`A${currentRow}`);
      sumBody.value = data.summary;
      sumBody.font = { name: 'Arial', size: 10, color: { argb: 'FF064E3B' } };
      sumBody.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      sumBody.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      sumBody.border = {
        left: { style: 'medium', color: { argb: 'FF059669' } },
        top: { style: 'thin', color: { argb: 'FFA7F3D0' } },
        bottom: { style: 'thin', color: { argb: 'FFA7F3D0' } },
        right: { style: 'thin', color: { argb: 'FFA7F3D0' } },
      };
      currentRow += 3;
    }

    // 4. Data Table Header Row (Mint Emerald #059669)
    const tableHeaderRow = sheet.getRow(currentRow);
    data.headers.forEach((h, i) => {
      const cell = tableHeaderRow.getCell(i + 1);
      cell.value = String(humanizeValue(h)).toUpperCase();
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF059669' }, // Muday Mint Emerald 600
      };
      cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF047857' } },
        bottom: { style: 'medium', color: { argb: 'FF047857' } },
      };
    });
    tableHeaderRow.height = 26;
    currentRow += 1;

    // 5. Data Table Rows
    data.rows.forEach((row, rowIdx) => {
      const dataRow = sheet.getRow(currentRow);
      const isEven = rowIdx % 2 === 0;

      row.forEach((val, colIdx) => {
        const cell = dataRow.getCell(colIdx + 1);
        const cleanVal = humanizeValue(val);
        cell.value = (
          cleanVal !== null && cleanVal !== undefined ? cleanVal : '—'
        ) as ExcelJS.CellValue;
        cell.font = { name: 'Arial', size: 10, color: { argb: 'FF0F172A' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF0FDF4' },
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        // If numeric value or amount, align right
        if (typeof cleanVal === 'number') {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0.00';
        } else if (typeof cleanVal === 'string' && cleanVal.endsWith('ETB')) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (typeof cleanVal === 'string' && cleanVal.endsWith('%')) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: colIdx === 0 ? 'left' : 'center', vertical: 'middle' };
        }
      });
      dataRow.height = 22;
      currentRow += 1;
    });

    // Auto-fit column widths
    sheet.columns.forEach((column) => {
      let maxLen = 14;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const valStr =
          typeof cell.value === 'string' || typeof cell.value === 'number'
            ? String(cell.value)
            : '';
        if (valStr.length > maxLen && valStr.length < 50) {
          maxLen = valStr.length;
        }
      });
      column.width = maxLen + 3;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generates a fully formatted Microsoft Word (.docx) executive report using Muday Mint styling.
   */
  async generateWord(data: ExportReportData): Promise<Buffer> {
    const docChildren: (Paragraph | Table)[] = [];

    // 1. Document Title
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: data.title,
            bold: true,
            size: 32, // 16pt
            color: '047857', // Muday Deep Emerald
          }),
        ],
        spacing: { before: 200, after: 80 },
      }),
    );

    // 2. Subtitle / Metadata
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${data.subtitle ?? 'Muday Financial Intelligence Report'}  |  Generated on ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' })} EAT`,
            italics: true,
            color: '065F46',
            size: 18, // 9pt
          }),
        ],
        spacing: { after: 260 },
      }),
    );

    // 3. Executive AI Summary Callout Box
    if (data.summary) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Executive Summary & Key Takeaways',
              bold: true,
              size: 24, // 12pt
              color: '047857',
            }),
          ],
          spacing: { before: 200, after: 100 },
        }),
      );

      const summaryCallout = new Table({
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: data.summary,
                        color: '064E3B',
                        size: 21, // 10.5pt
                      }),
                    ],
                  }),
                ],
                shading: { type: ShadingType.SOLID, color: 'F0FDF4' },
                borders: {
                  left: { style: BorderStyle.SINGLE, size: 24, color: '059669' },
                  top: { style: BorderStyle.SINGLE, size: 1, color: 'A7F3D0' },
                  right: { style: BorderStyle.SINGLE, size: 1, color: 'A7F3D0' },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'A7F3D0' },
                },
                margins: { top: 140, bottom: 140, left: 160, right: 140 },
              }),
            ],
          }),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
      });

      docChildren.push(summaryCallout);
      docChildren.push(new Paragraph({ text: '', spacing: { after: 240 } }));
    }

    // 4. KPI Highlights Grid (if provided)
    if (data.kpis && data.kpis.length > 0) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Key Performance Indicators',
              bold: true,
              size: 24, // 12pt
              color: '047857',
            }),
          ],
          spacing: { before: 180, after: 100 },
        }),
      );

      const kpiRowCells = data.kpis.map(
        (kpi) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: String(humanizeValue(kpi.label)).toUpperCase(),
                    bold: true,
                    size: 16, // 8pt
                    color: '047857',
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: String(humanizeValue(kpi.value)),
                    bold: true,
                    size: 24, // 12pt
                    color: '064E3B',
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 60 },
              }),
            ],
            shading: { type: ShadingType.SOLID, color: 'F0FDF4' },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'A7F3D0' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'A7F3D0' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'A7F3D0' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'A7F3D0' },
            },
            margins: { top: 140, bottom: 140, left: 140, right: 140 },
          }),
      );

      docChildren.push(
        new Table({
          rows: [new TableRow({ children: kpiRowCells })],
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
      );

      docChildren.push(new Paragraph({ text: '', spacing: { after: 240 } }));
    }

    // 5. Data Table
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Detailed Data Ledger',
            bold: true,
            size: 24, // 12pt
            color: '047857',
          }),
        ],
        spacing: { before: 180, after: 100 },
      }),
    );

    const headerCells = data.headers.map(
      (h) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: String(humanizeValue(h)).toUpperCase(),
                  bold: true,
                  color: 'FFFFFF',
                  size: 18,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { type: ShadingType.SOLID, color: '059669' }, // Emerald 600
          borders: {
            top: { style: BorderStyle.SINGLE, size: 2, color: '047857' },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: '047857' },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
          margins: { top: 120, bottom: 120, left: 120, right: 120 },
        }),
    );

    const tableRows = [new TableRow({ children: headerCells })];

    data.rows.forEach((row, idx) => {
      const isEven = idx % 2 === 0;
      const rowCells = row.map((val, colIdx) => {
        const cleanVal = humanizeValue(val);
        const displayStr =
          typeof cleanVal === 'string' || typeof cleanVal === 'number' ? String(cleanVal) : '—';

        return new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: displayStr,
                  size: 18,
                  color: '0F172A',
                }),
              ],
              alignment:
                typeof cleanVal === 'number' ||
                (typeof cleanVal === 'string' && cleanVal.endsWith('ETB'))
                  ? AlignmentType.RIGHT
                  : colIdx === 0
                    ? AlignmentType.LEFT
                    : AlignmentType.CENTER,
            }),
          ],
          shading: {
            type: ShadingType.SOLID,
            color: isEven ? 'FFFFFF' : 'F0FDF4',
          },
          borders: {
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
            top: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
        });
      });

      tableRows.push(new TableRow({ children: rowCells }));
    });

    docChildren.push(
      new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
    );

    const doc = new Document({
      sections: [
        {
          properties: {},
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'MUDAY CONSUMER FINANCE PLATFORM  |  CONFIDENTIAL EXECUTIVE REPORT',
                      color: '047857',
                      size: 14,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Page ', color: '94A3B8', size: 16 }),
                    new TextRun({ children: [PageNumber.CURRENT], color: '94A3B8', size: 16 }),
                    new TextRun({ text: ' of ', color: '94A3B8', size: 16 }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], color: '94A3B8', size: 16 }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          },
          children: docChildren,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  /**
   * Stores an export file buffer in memory and returns a 15-minute download token.
   */
  storeExportFile(filename: string, mimeType: string, buffer: Buffer): string {
    const token = randomUUID();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins TTL

    this.fileCache.set(token, {
      filename,
      mimeType,
      buffer,
      expiresAt,
    });

    return token;
  }

  /**
   * Retrieves a cached export file by token.
   */
  getExportFile(token: string): CachedExportFile | null {
    const file = this.fileCache.get(token);
    if (!file) return null;
    if (file.expiresAt < Date.now()) {
      this.fileCache.delete(token);
      return null;
    }
    return file;
  }
}
