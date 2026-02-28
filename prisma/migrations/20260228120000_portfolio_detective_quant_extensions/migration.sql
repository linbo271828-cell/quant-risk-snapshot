-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SEC_FILING', 'EARNINGS', 'NEWS');

-- CreateEnum
CREATE TYPE "BacktestFrequency" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "BacktestStrategy" AS ENUM ('BUY_HOLD', 'RISK_PARITY', 'MINVAR_QP');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventImpact" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "benchmark" TEXT NOT NULL,
    "post1dAbRet" DOUBLE PRECISION,
    "post3dAbRet" DOUBLE PRECISION,
    "post5dAbRet" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventImpact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectiveReport" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analyzeDate" TIMESTAMP(3) NOT NULL,
    "benchmark" TEXT NOT NULL,
    "summaryJson" JSONB NOT NULL,

    CONSTRAINT "DetectiveReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectiveReportItem" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "explanationJson" JSONB NOT NULL,

    CONSTRAINT "DetectiveReportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestRun" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "benchmark" TEXT NOT NULL,
    "frequency" "BacktestFrequency" NOT NULL,
    "strategy" "BacktestStrategy" NOT NULL,
    "paramsJson" JSONB NOT NULL,
    "metricsJson" JSONB NOT NULL,
    "seriesJson" JSONB NOT NULL,
    "weightsJson" JSONB NOT NULL,

    CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_portfolioId_ticker_eventTime_idx" ON "Event"("portfolioId", "ticker", "eventTime");

-- CreateIndex
CREATE INDEX "Event_type_eventTime_idx" ON "Event"("type", "eventTime");

-- CreateIndex
CREATE UNIQUE INDEX "Event_portfolioId_ticker_type_eventTime_title_key" ON "Event"("portfolioId", "ticker", "type", "eventTime", "title");

-- CreateIndex
CREATE INDEX "EventImpact_eventId_idx" ON "EventImpact"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventImpact_eventId_benchmark_key" ON "EventImpact"("eventId", "benchmark");

-- CreateIndex
CREATE INDEX "DetectiveReport_portfolioId_createdAt_idx" ON "DetectiveReport"("portfolioId", "createdAt");

-- CreateIndex
CREATE INDEX "DetectiveReportItem_reportId_score_idx" ON "DetectiveReportItem"("reportId", "score");

-- CreateIndex
CREATE INDEX "DetectiveReportItem_eventId_idx" ON "DetectiveReportItem"("eventId");

-- CreateIndex
CREATE INDEX "BacktestRun_portfolioId_createdAt_idx" ON "BacktestRun"("portfolioId", "createdAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventImpact" ADD CONSTRAINT "EventImpact_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectiveReport" ADD CONSTRAINT "DetectiveReport_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectiveReportItem" ADD CONSTRAINT "DetectiveReportItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DetectiveReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectiveReportItem" ADD CONSTRAINT "DetectiveReportItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestRun" ADD CONSTRAINT "BacktestRun_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
