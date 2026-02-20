-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "defaultsRange" TEXT NOT NULL DEFAULT '1y',
    "defaultsBenchmark" TEXT NOT NULL DEFAULT 'SPY',
    "defaultsRiskFreeRate" REAL NOT NULL DEFAULT 0,
    "defaultsShrinkage" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "portfolioId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Holding_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "portfolioId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "range" TEXT NOT NULL,
    "benchmark" TEXT NOT NULL,
    "riskFreeRate" REAL NOT NULL,
    "shrinkage" BOOLEAN NOT NULL,
    "metricsJson" JSONB NOT NULL,
    "seriesJson" JSONB NOT NULL,
    "riskJson" JSONB NOT NULL,
    "holdingsJson" JSONB NOT NULL,
    CONSTRAINT "Snapshot_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "portfolioId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "threshold" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertRule_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Holding_portfolioId_idx" ON "Holding"("portfolioId");

-- CreateIndex
CREATE INDEX "Snapshot_portfolioId_createdAt_idx" ON "Snapshot"("portfolioId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertRule_portfolioId_type_idx" ON "AlertRule"("portfolioId", "type");
