import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard.js';
import { AdminAiExportService } from './admin-ai-export.service.js';

export class DirectExportDto {
  @IsIn(['EXCEL', 'WORD'])
  @IsNotEmpty()
  format!: 'EXCEL' | 'WORD';

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  subtitle?: string;

  @IsArray()
  headers!: string[];

  @IsArray()
  rows!: Array<Array<string | number | null | undefined>>;

  @IsArray()
  @IsOptional()
  kpis?: Array<{ label: string; value: string }>;

  @IsString()
  @IsOptional()
  summary?: string;
}

@ApiTags('admin-ai-export')
@Controller('api/admin/ai/export')
export class AdminAiExportController {
  constructor(@Inject(AdminAiExportService) private readonly exportService: AdminAiExportService) {}

  @Post('direct')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Instantly generate an Excel or Word export from an AI visual payload' })
  async directExport(@Body() dto: DirectExportDto) {
    const isExcel = dto.format === 'EXCEL';
    const sanitizedTitle = (dto.title || 'Muday_Report').replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${sanitizedTitle}_${timestamp}.${isExcel ? 'xlsx' : 'docx'}`;
    const mimeType = isExcel
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const buffer = isExcel
      ? await this.exportService.generateExcel(dto)
      : await this.exportService.generateWord(dto);

    const token = this.exportService.storeExportFile(filename, mimeType, buffer);

    return {
      token,
      filename,
      format: dto.format,
      downloadUrl: `/api/admin/ai/export/download/${token}`,
      recordCount: dto.rows.length,
      fileSizeBytes: buffer.length,
    };
  }

  @Get('download/:token')
  @ApiOperation({ summary: 'Download generated Excel/Word report file by token' })
  downloadFile(@Param('token') token: string, @Res() res: Response) {
    const file = this.exportService.getExportFile(token);
    if (!file) {
      throw new NotFoundException(
        'Download link has expired or is invalid. Please generate a new export.',
      );
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.filename)}"`,
    );
    res.setHeader('Content-Length', file.buffer.length);
    res.end(file.buffer);
  }
}
