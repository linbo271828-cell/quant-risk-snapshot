-- Add userId so portfolios are private per signed-in user. Existing rows get a placeholder and won't be shown to any user.
ALTER TABLE "Portfolio" ADD COLUMN "userId" TEXT NOT NULL DEFAULT 'legacy';

CREATE INDEX "Portfolio_userId_idx" ON "Portfolio"("userId");

-- Remove default so new rows must supply userId (handled by app)
ALTER TABLE "Portfolio" ALTER COLUMN "userId" DROP DEFAULT;
