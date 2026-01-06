-- AlterTable
ALTER TABLE "monitored_wallets" ADD COLUMN "lastActiveAt" DATETIME;

-- CreateIndex
CREATE INDEX "monitored_wallets_lastActiveAt_idx" ON "monitored_wallets"("lastActiveAt");
