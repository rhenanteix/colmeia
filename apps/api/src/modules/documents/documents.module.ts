import { quota } from '../billing/quotas';
import {
  Module,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsUUID,
  IsIn,
  IsInt,
  Min,
} from 'class-validator';
import type { Response } from 'express';
import { basename } from 'node:path';
import { Db } from '../../platform/persistence/db';
import { Principal, CurrentPrincipal, JwtGuard, requireRole } from '../../security';
import { PersistenceModule } from '../../platform/persistence/persistence.module';
import { SecurityModule } from '../../platform/security/security.module';
import { LocalDocumentStorage, validateUpload, StoredUpload } from './storage';
import { Prisma } from '@prisma/client';
class FolderDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
}
class UploadDto {
  @IsOptional() @IsUUID() folderId?: string;
  @IsOptional() @IsUUID() taskId?: string;
  @IsOptional() @IsUUID() agentId?: string;
  @IsOptional() @IsUUID() wikiId?: string;
  @IsOptional() @IsIn(['organization', 'private']) visibility?: string;
}
class WikiDto {
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsString() @MaxLength(50000) content!: string;
  @IsIn(['organization', 'private']) visibility!: string;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @IsUUID() agentId?: string | null;
  @IsOptional() @IsUUID() boardId?: string | null;
}
class UpdateWikiDto extends WikiDto {
  @IsInt() @Min(1) revision!: number;
}
class RestoreDto {
  @IsInt() @Min(1) revision!: number;
  @IsInt() @Min(1) version!: number;
}
function access(p: Principal) {
  return {
    organizationId: p.organizationId,
    ...(['OWNER', 'ADMIN'].includes(p.role)
      ? {}
      : { OR: [{ visibility: 'organization' }, { ownerId: p.sub }] }),
  };
}
function edit(p: Principal, ownerId: string | null) {
  requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
  if (!['OWNER', 'ADMIN'].includes(p.role) && p.sub !== ownerId) throw new ForbiddenException();
}
@Controller('documents')
@UseGuards(JwtGuard)
class DocumentsController {
  constructor(
    private db: Db,
    private storage: LocalDocumentStorage,
  ) {}
  @Get('folders') folders(@CurrentPrincipal() p: Principal) {
    return this.db.documentFolder.findMany({
      where: { organizationId: p.organizationId },
      orderBy: { name: 'asc' },
    });
  }
  @Post('folders') folder(@CurrentPrincipal() p: Principal, @Body() d: FolderDto) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    if (!d.name.trim()) throw new BadRequestException();
    return this.db.documentFolder.create({
      data: { organizationId: p.organizationId, name: d.name.trim() },
    });
  }
  @Get('files') async files(
    @CurrentPrincipal() p: Principal,
    @Query('folderId') folderId?: string,
    @Query('wikiId') wikiId?: string,
  ) {
    const files = await this.db.knowledgeDocument.findMany({
      where: {
        ...access(p),
        status: 'ready',
        ...(folderId ? { folderId } : {}),
        ...(wikiId ? { wikiId } : {}),
        AND: [{ OR: [{ wikiId: null }, { wiki: access(p) }] }],
      },
      orderBy: { createdAt: 'desc' },
    });
    return files.map(({ storageKey: _key, ...f }) => f);
  }
  @Post('files')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 } }),
  )
  async upload(
    @CurrentPrincipal() p: Principal,
    @UploadedFile() upload: StoredUpload,
    @Body() d: UploadDto,
  ) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    const file = validateUpload(upload);
    const key = await this.storage.put(file.buffer);
    try {
      const created = await this.db.$transaction(async (tx) => {
        for (const [kind, id] of Object.entries(d)) {
          if (!id || kind === 'visibility') continue;
          const where = { id, organizationId: p.organizationId };
          const valid =
            kind === 'folderId'
              ? await tx.documentFolder.findFirst({ where })
              : kind === 'taskId'
                ? await tx.task.findFirst({ where })
                : kind === 'agentId'
                  ? await tx.agent.findFirst({ where })
                  : await tx.wikiPage.findFirst({ where: { id, ...access(p) } });
          if (!valid) throw new BadRequestException('Associação inválida.');
        }
        await quota(tx, p.organizationId, 'files');
        await quota(tx, p.organizationId, 'storage', file.size);
        const doc = await tx.knowledgeDocument.create({
          data: {
            ...d,
            visibility: d.visibility || 'organization',
            organizationId: p.organizationId,
            ownerId: p.sub,
            name:
              basename(file.originalname)
                .replace(/[\r\n\x00-\x1f]/g, '')
                .slice(0, 200) || 'arquivo',
            storageKey: key,
            status: 'ready',
            size: file.size,
            mimeType: file.mimetype,
          },
        });
        await tx.auditEvent.create({
          data: {
            organizationId: p.organizationId,
            actorSubject: p.sub,
            action: 'file.uploaded',
            resourceId: doc.id,
            metadata: { bytes: file.size },
          },
        });
        return doc;
      });
      const { storageKey: _key, ...result } = created;
      return result;
    } catch (e) {
      await this.storage.remove(key);
      throw e;
    }
  }
  @Get('files/:id/download') async download(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.db.knowledgeDocument.findFirst({
      where: {
        id,
        ...access(p),
        status: 'ready',
        AND: [{ OR: [{ wikiId: null }, { wiki: access(p) }] }],
      },
    });
    if (!file) throw new NotFoundException();
    let bytes: Buffer;
    try {
      bytes = await this.storage.read(file.storageKey);
    } catch {
      throw new NotFoundException('Arquivo indisponível no armazenamento.');
    }
    res
      .set({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      })
      .send(bytes);
  }
  @Delete('files/:id') async remove(@CurrentPrincipal() p: Principal, @Param('id') id: string) {
    const file = await this.db.knowledgeDocument.findFirst({
      where: { id, organizationId: p.organizationId },
    });
    if (!file) throw new NotFoundException();
    edit(p, file.ownerId);
    await this.db.knowledgeDocument.update({ where: { id }, data: { status: 'deleting' } });
    await this.storage.remove(file.storageKey);
    await this.db.$transaction(async (tx) => {
      const deleted = await tx.knowledgeDocument.deleteMany({
        where: { id, organizationId: p.organizationId },
      });
      if (deleted.count)
        await tx.auditEvent.create({
          data: {
            organizationId: p.organizationId,
            actorSubject: p.sub,
            action: 'file.deleted',
            resourceId: id,
          },
        });
    });
    return { ok: true };
  }
  @Get('wiki') wiki(@CurrentPrincipal() p: Principal, @Query('q') q?: string) {
    return this.db.wikiPage.findMany({
      where: {
        ...access(p),
        ...(q
          ? {
              AND: [
                {
                  OR: [
                    { title: { contains: q.slice(0, 200), mode: 'insensitive' } },
                    { content: { contains: q.slice(0, 200), mode: 'insensitive' } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: { title: 'asc' },
    });
  }
  private async wikiRefs(tx: Prisma.TransactionClient, p: Principal, d: WikiDto, pageId?: string) {
    if (d.title.trim().length < 2) throw new BadRequestException('Informe um título.');
    if (
      d.agentId &&
      !(await tx.agent.findFirst({ where: { id: d.agentId, organizationId: p.organizationId } }))
    )
      throw new BadRequestException('Agente inválido.');
    if (
      d.boardId &&
      !(await tx.taskBoard.findFirst({
        where: { id: d.boardId, organizationId: p.organizationId },
      }))
    )
      throw new BadRequestException('Quadro inválido.');
    let parent = d.parentId;
    const visited = new Set<string>();
    while (parent) {
      if (parent === pageId || visited.has(parent) || visited.size >= 64)
        throw new BadRequestException('Hierarquia circular ou profunda demais.');
      visited.add(parent);
      const page = await tx.wikiPage.findFirst({ where: { id: parent, ...access(p) } });
      if (!page) throw new BadRequestException('Página superior inválida.');
      parent = page.parentId;
    }
  }
  @Post('wiki') async createWiki(@CurrentPrincipal() p: Principal, @Body() d: WikiDto) {
    requireRole(p, 'OWNER', 'ADMIN', 'MEMBER');
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${p.organizationId} FOR UPDATE`;
      await this.wikiRefs(tx, p, d);
      const page = await tx.wikiPage.create({
        data: { ...d, title: d.title.trim(), organizationId: p.organizationId, ownerId: p.sub },
      });
      await tx.wikiVersion.create({
        data: {
          organizationId: p.organizationId,
          pageId: page.id,
          revision: 1,
          title: page.title,
          content: page.content,
          authorId: p.sub,
        },
      });
      return page;
    });
  }
  @Patch('wiki/:id') async updateWiki(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
    @Body() d: UpdateWikiDto,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${p.organizationId} FOR UPDATE`;
      const page = await tx.wikiPage.findFirst({ where: { id, ...access(p) } });
      if (!page) throw new NotFoundException();
      edit(p, page.ownerId);
      if (page.revision !== d.revision)
        throw new ConflictException('Página alterada por outra pessoa.');
      await this.wikiRefs(tx, p, d, id);
      const updated = await tx.wikiPage.update({
        where: { id },
        data: { ...d, title: d.title.trim(), revision: { increment: 1 } },
      });
      await tx.wikiVersion.create({
        data: {
          organizationId: p.organizationId,
          pageId: id,
          revision: updated.revision,
          title: updated.title,
          content: updated.content,
          authorId: p.sub,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: p.organizationId,
          actorSubject: p.sub,
          action: 'wiki.updated',
          resourceId: id,
          metadata: { revision: updated.revision },
        },
      });
      return updated;
    });
  }
  @Get('wiki/:id/versions') async versions(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
  ) {
    if (!(await this.db.wikiPage.findFirst({ where: { id, ...access(p) } })))
      throw new NotFoundException();
    return this.db.wikiVersion.findMany({
      where: { pageId: id, organizationId: p.organizationId },
      orderBy: { revision: 'desc' },
    });
  }
  @Post('wiki/:id/restore') async restore(
    @CurrentPrincipal() p: Principal,
    @Param('id') id: string,
    @Body() d: RestoreDto,
  ) {
    const page = await this.db.wikiPage.findFirst({ where: { id, ...access(p) } });
    if (!page) throw new NotFoundException();
    edit(p, page.ownerId);
    const version = await this.db.wikiVersion.findFirst({
      where: { pageId: id, organizationId: p.organizationId, revision: d.version },
    });
    if (!version) throw new NotFoundException();
    return this.updateWiki(p, id, {
      title: version.title,
      content: version.content,
      visibility: page.visibility,
      revision: d.revision,
    });
  }
}
@Module({
  imports: [PersistenceModule, SecurityModule],
  controllers: [DocumentsController],
  providers: [LocalDocumentStorage],
})
export class DocumentsModule {}
