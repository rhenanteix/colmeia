ALTER TABLE "Membership" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
ALTER TABLE "Channel" ADD COLUMN "directKey" TEXT, ADD COLUMN "participantIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE UNIQUE INDEX "Channel_organizationId_directKey_key" ON "Channel"("organizationId", "directKey");
ALTER TABLE "Message" ADD COLUMN "parentId" TEXT, ADD COLUMN "mentionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE UNIQUE INDEX "Message_id_channelId_organizationId_key" ON "Message"("id", "channelId", "organizationId");
ALTER TABLE "Message" ADD CONSTRAINT "Message_parentId_channelId_organizationId_fkey" FOREIGN KEY ("parentId", "channelId", "organizationId") REFERENCES "Message"("id", "channelId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
