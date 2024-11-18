-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'AUTHENTICATION',
ADD COLUMN     "used" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usedAt" TIMESTAMP(3),
ADD COLUMN     "verificationSuccess" BOOLEAN;

-- CreateIndex
CREATE INDEX "Challenge_userId_active_used_idx" ON "Challenge"("userId", "active", "used");

-- CreateIndex
CREATE INDEX "Challenge_createdAt_idx" ON "Challenge"("createdAt");

-- CreateIndex
CREATE INDEX "Challenge_expiresAt_idx" ON "Challenge"("expiresAt");
