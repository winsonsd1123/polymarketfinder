-- CreateTable
CREATE TABLE "monitored_wallets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "riskScore" REAL NOT NULL DEFAULT 0,
    "fundingSource" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "trade_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "isBuy" BOOLEAN NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletId" TEXT NOT NULL,
    CONSTRAINT "trade_events_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "monitored_wallets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trade_events_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "volume" REAL NOT NULL DEFAULT 0,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "monitored_wallets_address_key" ON "monitored_wallets"("address");

-- CreateIndex
CREATE INDEX "monitored_wallets_address_idx" ON "monitored_wallets"("address");

-- CreateIndex
CREATE INDEX "monitored_wallets_riskScore_idx" ON "monitored_wallets"("riskScore");

-- CreateIndex
CREATE INDEX "trade_events_walletId_idx" ON "trade_events"("walletId");

-- CreateIndex
CREATE INDEX "trade_events_marketId_idx" ON "trade_events"("marketId");

-- CreateIndex
CREATE INDEX "trade_events_timestamp_idx" ON "trade_events"("timestamp");

-- CreateIndex
CREATE INDEX "markets_endDate_idx" ON "markets"("endDate");
