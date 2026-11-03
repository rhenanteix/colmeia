import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsInt,
  IsUUID,
  Min,
  Max,
  IsIn,
  IsArray,
  ArrayMaxSize,
  IsISO8601,
  IsBoolean,
} from 'class-validator';
import { Prisma } from '@prisma/client';
import { Db } from '../../platform/persistence/db';
import { JwtGuard, CurrentPrincipal, Principal, requireRole } from '../../security';
class NameDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
}
class ColumnDto extends NameDto {
  @IsOptional() @IsInt() @Min(0) @Max(1000) position?: number;
}
class TaskDto {
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsUUID() assignedTo?: string | null;
  @IsOptional() @IsUUID() boardId?: string;
  @IsOptional() @IsUUID() columnId?: string;
  @IsOptional() @IsIn(['low', 'normal', 'high', 'urgent']) priority?: string;
  @IsOptional() @IsISO8601() dueAt?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  labels?: string[];
}
class UpdateTaskDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsUUID() assignedTo?: string | null;
  @IsOptional() @IsIn(['todo', 'doing', 'done']) status?: string;
  @IsOptional() @IsUUID() columnId?: string;
  @IsOptional() @IsIn(['low', 'normal', 'high', 'urgent']) priority?: string;
  @IsOptional() @IsISO8601() dueAt?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  labels?: string[];
  @IsOptional() @IsBoolean() archived?: boolean;
  @IsOptional() @IsInt() @Min(0) revision?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) position?: number;
}
class CommentDto {
  @IsString() @MinLength(1) @MaxLength(4000) body!: string;
}
async function assignee(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId?: string | null,
) {
  if (!userId) return;
  const rows = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT id FROM "Membership" WHERE "userId" = ${userId} AND "organizationId" = ${organizationId} FOR SHARE`;
  if (!rows.length) throw new BadRequestException('Responsável não pertence à organização.');
}
@Controller('tasks')
@UseGuards(JwtGuard)
export class TasksController {
  constructor(private db: Db) {}
  @Get('boards') boards(@CurrentPrincipal() p: Principal) {
    return this.db.taskBoard.findMany({
      where: { organizationId: p.organizationId },
      include: { columns: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } },
      orderBy: { createdAt: 'asc' },
    });
  }
  @Post('boards') createBoard(@CurrentPrincipal() p: Principal, @Body() d: NameDto) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    if (!d.name.trim()) throw new BadRequestException('Informe um nome.');
    return this.db.$transaction(async (tx) => {
      const board = await tx.taskBoard.create({
        data: { organizationId: p.organizationId, name: d.name.trim() },
      });
      await tx.taskColumn.createMany({
        data: ['A fazer', 'Em andamento', 'Concluída'].map((name, position) => ({
          boardId: board.id,
          organizationId: p.organizationId,
          name,
          position,
        })),
      });
      return tx.taskBoard.findUniqueOrThrow({
        where: { id: board.id },
        include: { columns: { orderBy: { position: 'asc' } } },
      });
    });
  }
  @Patch('boards/:id') async renameBoard(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
    @Body() d: NameDto,
  ) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    if (!d.name.trim()) throw new BadRequestException('Informe um nome.');
    const result = await this.db.taskBoard.updateMany({
      where: { id, organizationId: p.organizationId },
      data: { name: d.name.trim() },
    });
    if (!result.count) throw new NotFoundException();
    return { ok: true };
  }
  @Post('boards/:id/columns') async createColumn(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
    @Body() d: ColumnDto,
  ) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    if (!d.name.trim()) throw new BadRequestException('Informe um nome.');
    const board = await this.db.taskBoard.findFirst({
      where: { id, organizationId: p.organizationId },
    });
    if (!board) throw new NotFoundException();
    return this.db.taskColumn.create({
      data: {
        boardId: id,
        organizationId: p.organizationId,
        name: d.name.trim(),
        position: d.position ?? 100,
      },
    });
  }
  @Patch('columns/:id') async updateColumn(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
    @Body() d: ColumnDto,
  ) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    if (!d.name.trim()) throw new BadRequestException('Informe um nome.');
    const result = await this.db.taskColumn.updateMany({
      where: { id, organizationId: p.organizationId },
      data: { name: d.name.trim(), position: d.position },
    });
    if (!result.count) throw new NotFoundException();
    return { ok: true };
  }
  @Get() list(
    @CurrentPrincipal() p: Principal,
    @Query('boardId') boardId?: string,
    @Query('q') q?: string,
    @Query('priority') priority?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('archived') archived?: string,
  ) {
    return this.db.task.findMany({
      where: {
        organizationId: p.organizationId,
        ...(boardId ? { boardId: boardId === 'none' ? null : boardId } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q.slice(0, 200), mode: 'insensitive' } },
                { description: { contains: q.slice(0, 200), mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(priority ? { priority } : {}),
        ...(assignedTo ? { assignedTo } : {}),
        archivedAt: archived === 'true' ? { not: null } : null,
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });
  }
  @Get(':id/history') async history(@CurrentPrincipal() p: Principal, @Param('id') id: string) {
    await this.getTask(p, id);
    return this.db.auditEvent.findMany({
      where: { organizationId: p.organizationId, resourceId: id, action: { startsWith: 'task.' } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
  @Get(':id/comments') async comments(@CurrentPrincipal() p: Principal, @Param('id') id: string) {
    await this.getTask(p, id);
    return this.db.taskComment.findMany({
      where: { organizationId: p.organizationId, taskId: id },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
  }
  @Post(':id/comments') async comment(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
    @Body() d: CommentDto,
  ) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    await this.getTask(p, id);
    if (!d.body.trim()) throw new BadRequestException('Comentário vazio.');
    return this.db.$transaction(async (tx) => {
      const comment = await tx.taskComment.create({
        data: {
          taskId: id,
          organizationId: p.organizationId,
          authorSubject: p.sub,
          body: d.body.trim(),
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: p.organizationId,
          actorSubject: p.sub,
          action: 'task.commented',
          resourceId: id,
          metadata: { commentId: comment.id },
        },
      });
      return comment;
    });
  }
  private async getTask(p: Principal, id: string) {
    const task = await this.db.task.findFirst({ where: { id, organizationId: p.organizationId } });
    if (!task) throw new NotFoundException();
    return task;
  }
  @Post() create(@CurrentPrincipal() p: Principal, @Body() d: TaskDto) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    if (
      Object.entries(d).some(
        ([key, value]) => value === null && !['assignedTo', 'dueAt', 'description'].includes(key),
      )
    )
      throw new BadRequestException('Campo não pode ser nulo.');
    if (d.title.trim().length < 2) throw new BadRequestException('Informe um título.');
    return this.db.$transaction(async (tx) => {
      await assignee(tx, p.organizationId, d.assignedTo);
      let columnId = d.columnId;
      if (d.boardId) {
        const column = await tx.taskColumn.findFirst({
          where: {
            boardId: d.boardId,
            organizationId: p.organizationId,
            ...(columnId ? { id: columnId } : {}),
          },
          orderBy: { position: 'asc' },
        });
        if (!column) throw new BadRequestException('Quadro ou coluna inválidos.');
        columnId = column.id;
      } else if (columnId) throw new BadRequestException('Informe o quadro.');
      const task = await tx.task.create({
        data: {
          ...d,
          title: d.title.trim(),
          columnId,
          organizationId: p.organizationId,
          createdBy: p.sub,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: p.organizationId,
          actorSubject: p.sub,
          action: 'task.created',
          resourceId: task.id,
        },
      });
      return task;
    });
  }
  @Patch(':id') async update(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
    @Body() d: UpdateTaskDto,
  ) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM "Task" WHERE id = ${id} AND "organizationId" = ${p.organizationId} FOR UPDATE`;
      if (!rows.length) throw new NotFoundException();
      const before = await tx.task.findUniqueOrThrow({ where: { id } });
      if (
        Object.entries(d).some(
          ([key, value]) => value === null && !['assignedTo', 'dueAt', 'description'].includes(key),
        )
      )
        throw new BadRequestException('Campo não pode ser nulo.');
      // Legacy status-only callers remain compatible. All richer edits require a revision.
      if (
        d.revision === undefined &&
        Object.entries(d).some(([key, value]) => key !== 'status' && value !== undefined)
      )
        throw new BadRequestException('Informe a revisão da tarefa.');
      if (d.revision !== undefined && d.revision !== before.revision)
        throw new ConflictException(
          'Tarefa alterada por outra pessoa. Recarregue e tente novamente.',
        );
      if (d.title !== undefined && d.title.trim().length < 2)
        throw new BadRequestException('Informe um título.');
      await assignee(tx, p.organizationId, d.assignedTo);
      if (d.columnId) {
        if (
          !before.boardId ||
          !(await tx.taskColumn.findFirst({
            where: { id: d.columnId, boardId: before.boardId, organizationId: p.organizationId },
          }))
        )
          throw new BadRequestException('Coluna não pertence ao quadro.');
      }
      if (before.boardId && d.status)
        throw new BadRequestException('Mova a tarefa para uma coluna do quadro.');
      const { revision: _revision, archived, ...fields } = d;
      const task = await tx.task.update({
        where: { id },
        data: {
          ...fields,
          ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
          revision: { increment: 1 },
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: p.organizationId,
          actorSubject: p.sub,
          action: d.columnId || d.status ? 'task.moved' : 'task.updated',
          resourceId: id,
          metadata: {
            before: { status: before.status, columnId: before.columnId, revision: before.revision },
            changes: JSON.parse(JSON.stringify(d)) as Prisma.InputJsonValue,
          },
        },
      });
      return task;
    });
  }
}
