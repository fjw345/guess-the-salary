-- Initial schema for the guess-salary application.
CREATE TYPE "Degree" AS ENUM ('COLLEGE', 'BACHELOR', 'MASTER', 'DOCTOR');
CREATE TYPE "SalaryPeriod" AS ENUM ('MONTHLY', 'ANNUAL', 'UNKNOWN');
CREATE TYPE "SalaryBasis" AS ENUM ('PRETAX', 'AFTERTAX', 'UNKNOWN');
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "SourceType" AS ENUM ('SEED', 'SURVEY', 'SELF_REPORT');
CREATE TYPE "ReportReason" AS ENUM ('IDENTITY_LEAK', 'FALSE_INFO', 'OFFENSIVE', 'OTHER');
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "School" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "aliases" TEXT[] NOT NULL,
  "tags" TEXT[] NOT NULL,
  CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Submission" (
  "id" TEXT NOT NULL,
  "degree" "Degree" NOT NULL,
  "schoolId" INTEGER,
  "schoolNameRaw" TEXT NOT NULL,
  "major" TEXT NOT NULL,
  "tenureText" TEXT NOT NULL,
  "tenureMonths" INTEGER,
  "city" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "position" TEXT NOT NULL,
  "salaryRaw" TEXT NOT NULL,
  "salaryAmount" INTEGER,
  "salaryPeriod" "SalaryPeriod" NOT NULL,
  "salaryBasis" "SalaryBasis" NOT NULL,
  "salaryIsIntern" BOOLEAN NOT NULL DEFAULT false,
  "salaryHasPlus" BOOLEAN NOT NULL DEFAULT false,
  "roughAnnual" INTEGER,
  "authorNote" TEXT,
  "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  "rejectReason" TEXT,
  "sourceType" "SourceType" NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "ipHash" TEXT,
  "sourceRow" INTEGER,
  CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameRound" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "guessAmount" INTEGER,
  "guessPeriod" "SalaryPeriod",
  "servedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "answeredAt" TIMESTAMP(3),
  CONSTRAINT "GameRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentReport" (
  "id" TEXT NOT NULL,
  "roundId" TEXT,
  "reason" "ReportReason" NOT NULL,
  "details" TEXT NOT NULL,
  "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "School_name_key" ON "School"("name");
CREATE INDEX "Submission_status_roughAnnual_idx" ON "Submission"("status", "roughAnnual");
CREATE INDEX "GameRound_sessionId_idx" ON "GameRound"("sessionId");
CREATE INDEX "ContentReport_status_createdAt_idx" ON "ContentReport"("status", "createdAt");

ALTER TABLE "Submission" ADD CONSTRAINT "Submission_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
