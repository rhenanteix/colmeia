ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentDraft" ADD CONSTRAINT "AgentDraft_agentId_organizationId_fkey" FOREIGN KEY ("agentId", "organizationId") REFERENCES "Agent"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "PasswordResetToken" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "tokenHash" TEXT NOT NULL UNIQUE,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "consumedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

CREATE UNIQUE INDEX "AgentDraft_agentId_organizationId_key" ON "AgentDraft"("agentId", "organizationId");
