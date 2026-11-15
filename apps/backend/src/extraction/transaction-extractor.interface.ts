import type { ExtractionResult } from '@mezgeb/contracts';

import type { FinancialEventClassification } from './financial-event-classification.schema.js';

export interface ExtractionInput {
  text: string;
  locale: 'am' | 'en';
}

export interface AudioExtractionInput {
  wavPath: string;
  locale: 'am' | 'en';
}

export interface ImageExtractionInput {
  imagePath: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  locale: 'am' | 'en';
}

export interface TransactionExtractor {
  readonly model: string;
  readonly audioModel?: string;
  readonly promptVersion: string;
  extract(input: ExtractionInput): Promise<ExtractionResult>;
  extractAudio?(input: AudioExtractionInput): Promise<ExtractionResult>;
  extractImage?(input: ImageExtractionInput): Promise<ExtractionResult>;
  classify?(input: ExtractionInput, userId: string): Promise<FinancialEventClassification>;
  classifyAudio?(
    input: AudioExtractionInput,
    userId: string,
  ): Promise<FinancialEventClassification>;
  classifyImage?(
    input: ImageExtractionInput,
    userId: string,
  ): Promise<FinancialEventClassification>;
}

export interface FinancialEventClassifier {
  classify(input: ExtractionInput, userId: string): Promise<FinancialEventClassification>;
  classifyAudio(input: AudioExtractionInput, userId: string): Promise<FinancialEventClassification>;
  classifyImage(input: ImageExtractionInput, userId: string): Promise<FinancialEventClassification>;
}

export const TRANSACTION_EXTRACTOR = Symbol('TRANSACTION_EXTRACTOR');
