ALTER TABLE "AgentTemplate" ADD COLUMN "organizationId" TEXT;
UPDATE "AgentTemplate" SET "organizationId" = substring("id" from 8 for 36) WHERE "id" LIKE 'custom-%';
ALTER TABLE "AgentVersion" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AgentVersion" ADD COLUMN "authorSubject" TEXT;
