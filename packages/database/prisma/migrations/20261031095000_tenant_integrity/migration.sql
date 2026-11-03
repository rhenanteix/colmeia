BEGIN;

-- DropForeignKey
ALTER TABLE "AgentExecution" DROP CONSTRAINT "AgentExecution_agentId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_channelId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "AgentExecution_id_organizationId_key" ON "AgentExecution"("id", "organizationId");

-- CreateIndex
CREATE INDEX "AgentTemplate_organizationId_category_idx" ON "AgentTemplate"("organizationId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_id_organizationId_key" ON "Channel"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeInstance_id_organizationId_key" ON "RuntimeInstance"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "AgentExecution" ADD CONSTRAINT "AgentExecution_agentId_organizationId_fkey" FOREIGN KEY ("agentId", "organizationId") REFERENCES "Agent"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_agentId_organizationId_fkey" FOREIGN KEY ("agentId", "organizationId") REFERENCES "Agent"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_channelId_organizationId_fkey" FOREIGN KEY ("channelId", "organizationId") REFERENCES "Channel"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_agentId_organizationId_fkey" FOREIGN KEY ("agentId", "organizationId") REFERENCES "Agent"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedgerEntry" ADD CONSTRAINT "UsageLedgerEntry_executionId_organizationId_fkey" FOREIGN KEY ("executionId", "organizationId") REFERENCES "AgentExecution"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedgerEntry" ADD CONSTRAINT "UsageLedgerEntry_agentId_organizationId_fkey" FOREIGN KEY ("agentId", "organizationId") REFERENCES "Agent"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedgerEntry" ADD CONSTRAINT "UsageLedgerEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantBudget" ADD CONSTRAINT "TenantBudget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuntimeOperation" ADD CONSTRAINT "RuntimeOperation_runtimeId_organizationId_fkey" FOREIGN KEY ("runtimeId", "organizationId") REFERENCES "RuntimeInstance"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuntimeOperation" ADD CONSTRAINT "RuntimeOperation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTemplate" ADD CONSTRAINT "AgentTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeeHandoff" ADD CONSTRAINT "BeeHandoff_channelId_organizationId_fkey" FOREIGN KEY ("channelId", "organizationId") REFERENCES "Channel"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeeHandoff" ADD CONSTRAINT "BeeHandoff_sourceAgentId_organizationId_fkey" FOREIGN KEY ("sourceAgentId", "organizationId") REFERENCES "Agent"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeeHandoff" ADD CONSTRAINT "BeeHandoff_targetAgentId_organizationId_fkey" FOREIGN KEY ("targetAgentId", "organizationId") REFERENCES "Agent"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeeHandoff" ADD CONSTRAINT "BeeHandoff_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


COMMIT;
