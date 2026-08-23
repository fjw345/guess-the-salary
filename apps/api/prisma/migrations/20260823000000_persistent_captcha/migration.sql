CREATE TABLE "CaptchaChallenge" (
  "token" TEXT NOT NULL,
  "answer" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaptchaChallenge_pkey" PRIMARY KEY ("token")
);

CREATE INDEX "CaptchaChallenge_expiresAt_idx" ON "CaptchaChallenge"("expiresAt");
