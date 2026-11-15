import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard, type AuthenticatedAdminRequest } from '../admin-auth/admin-auth.guard.js';
import { AdminAiService } from './admin-ai.service.js';
import { AdminAiSessionRepository } from './admin-ai-session.repository.js';
import { AdminAiChatRequestDto, AdminAiChatResponseDto } from './admin-ai.dto.js';

@ApiTags('admin-ai')
@Controller('api/admin/ai')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class AdminAiController {
  constructor(
    @Inject(AdminAiService) private readonly aiService: AdminAiService,
    @Inject(AdminAiSessionRepository) private readonly sessionRepository: AdminAiSessionRepository,
  ) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send conversational query to Admin AI Data Assistant' })
  @ApiResponse({ status: 200, type: AdminAiChatResponseDto })
  async chat(
    @Body() dto: AdminAiChatRequestDto,
    @Req() request: AuthenticatedAdminRequest,
  ): Promise<AdminAiChatResponseDto> {
    const adminId = request.adminUser?.sub ?? 'default-admin';
    return this.aiService.chat(adminId, dto);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List active conversation sessions for authenticated admin' })
  async listSessions(@Req() request: AuthenticatedAdminRequest) {
    const adminId = request.adminUser?.sub ?? 'default-admin';
    return this.sessionRepository.listSessions(adminId);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete active conversation session from memory' })
  async deleteSession(@Param('id') sessionId: string, @Req() request: AuthenticatedAdminRequest) {
    const adminId = request.adminUser?.sub ?? 'default-admin';
    await this.sessionRepository.deleteSession(adminId, sessionId);
  }
}
