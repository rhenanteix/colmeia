-- AlterTable
ALTER TABLE "RuntimeInstance" ADD COLUMN     "checkedAt" TIMESTAMP(3),
ADD COLUMN     "encryptedToken" TEXT,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "gatewayUrl" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

