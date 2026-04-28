import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../shared/authenticated-request';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async listRooms(): Promise<{
    rooms: Array<{
      id: string;
      name: string;
      createdBy: string;
      activeUsers: number;
      createdAt: string;
    }>;
  }> {
    return this.roomsService.listRooms();
  }

  @Post()
  async createRoom(
    @Body() dto: CreateRoomDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    id: string;
    name: string;
    createdBy: string;
    createdAt: string;
  }> {
    return this.roomsService.createRoom(dto.name, user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getRoom(@Param('id') id: string): Promise<{
    id: string;
    name: string;
    createdBy: string;
    activeUsers: number;
    createdAt: string;
  }> {
    return this.roomsService.getRoom(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteRoom(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ deleted: true }> {
    return this.roomsService.deleteRoom(id, user);
  }

  @Get(':id/messages')
  @HttpCode(HttpStatus.OK)
  async listMessages(
    @Param('id') roomId: string,
    @Query() query: ListMessagesQueryDto,
  ): Promise<{
    messages: Array<{
      id: string;
      roomId: string;
      username: string;
      content: string;
      createdAt: string;
    }>;
    hasMore: boolean;
    nextCursor: string | null;
  }> {
    return this.roomsService.listMessages(roomId, query.limit, query.before);
  }

  @Post(':id/messages')
  async createMessage(
    @Param('id') roomId: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    id: string;
    roomId: string;
    username: string;
    content: string;
    createdAt: string;
  }> {
    return this.roomsService.createMessage(roomId, dto.content, user);
  }
}
