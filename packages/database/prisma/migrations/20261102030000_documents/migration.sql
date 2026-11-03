-- AlterTable
ALTER TABLE "KnowledgeDocument" ADD COLUMN     "agentId" TEXT,
ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "size" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taskId" TEXT,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'organization',
ADD COLUMN     "wikiId" TEXT;

-- CreateTable
CREATE TABLE "DocumentFolder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "DocumentFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiPage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'organization',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "agentId" TEXT,
    "boardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikiVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentFolder_organizationId_idx" ON "DocumentFolder"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFolder_id_organizationId_key" ON "DocumentFolder"("id", "organizationId");

-- CreateIndex
CREATE INDEX "WikiPage_organizationId_idx" ON "WikiPage"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "WikiPage_id_organizationId_key" ON "WikiPage"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "WikiVersion_pageId_revision_key" ON "WikiVersion"("pageId", "revision");

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_folderId_organizationId_fkey" FOREIGN KEY ("folderId", "organizationId") REFERENCES "DocumentFolder"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_taskId_organizationId_fkey" FOREIGN KEY ("taskId", "organizationId") REFERENCES "Task"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_agentId_organizationId_fkey" FOREIGN KEY ("agentId", "organizationId") REFERENCES "Agent"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_wikiId_organizationId_fkey" FOREIGN KEY ("wikiId", "organizationId") REFERENCES "WikiPage"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFolder" ADD CONSTRAINT "DocumentFolder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_parentId_organizationId_fkey" FOREIGN KEY ("parentId", "organizationId") REFERENCES "WikiPage"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_agentId_organizationId_fkey" FOREIGN KEY ("agentId", "organizationId") REFERENCES "Agent"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_boardId_organizationId_fkey" FOREIGN KEY ("boardId", "organizationId") REFERENCES "TaskBoard"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiVersion" ADD CONSTRAINT "WikiVersion_pageId_organizationId_fkey" FOREIGN KEY ("pageId", "organizationId") REFERENCES "WikiPage"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

