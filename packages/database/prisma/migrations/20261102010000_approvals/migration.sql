-- AlterTable
ALTER TABLE "ApprovalRequest" ADD COLUMN     "approverId" TEXT,
ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "targetColumnId" TEXT,
ADD COLUMN     "targetStatus" TEXT,
ADD COLUMN     "taskId" TEXT,
ADD COLUMN     "taskRevision" INTEGER,
ALTER COLUMN "agentId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_taskId_organizationId_fkey" FOREIGN KEY ("taskId", "organizationId") REFERENCES "Task"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

