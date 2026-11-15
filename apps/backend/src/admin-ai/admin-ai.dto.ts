import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { ToolExecutionRecord, VisualDataPayload } from './admin-ai.types.js';

export class AdminAiChatRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string | undefined;
}

export class AdminAiChatResponseDto {
  sessionId!: string;
  reply!: string;
  toolsExecuted!: ToolExecutionRecord[];
  visualData?: VisualDataPayload | undefined;
}

export class AdminAiSessionSummaryDto {
  sessionId!: string;
  title!: string;
  messageCount!: number;
  lastMessageAt!: string;
}
