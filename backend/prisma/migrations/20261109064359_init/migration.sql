-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "public"."ContainerSize" AS ENUM ('FT20', 'FT40');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'OPERATOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Importer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Importer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShippingAgent" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Job" (
    "id" SERIAL NOT NULL,
    "jobNo" TEXT NOT NULL,
    "cNumber" TEXT,
    "importerId" INTEGER NOT NULL,
    "agentId" INTEGER NOT NULL,
    "containerCount" INTEGER NOT NULL,
    "containerSize" "public"."ContainerSize" NOT NULL DEFAULT 'FT20',
    "ratePerContainer" INTEGER NOT NULL,
    "depotReceivedAt" DATE,
    "surveyReceivedAt" DATE,
    "submittedToAgentAt" DATE,
    "agentBillAt" DATE,
    "actualCost" INTEGER,
    "releasedAt" DATE,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Setting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "defaultRate" INTEGER NOT NULL DEFAULT 10000,
    "surveyDays" INTEGER NOT NULL DEFAULT 7,
    "billDays" INTEGER NOT NULL DEFAULT 7,
    "releaseDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER,
    "jobNo" TEXT NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Importer_name_key" ON "public"."Importer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingAgent_name_key" ON "public"."ShippingAgent"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Job_jobNo_key" ON "public"."Job"("jobNo");

-- CreateIndex
CREATE UNIQUE INDEX "Job_cNumber_key" ON "public"."Job"("cNumber");

-- CreateIndex
CREATE INDEX "Job_importerId_idx" ON "public"."Job"("importerId");

-- CreateIndex
CREATE INDEX "Job_agentId_idx" ON "public"."Job"("agentId");

-- CreateIndex
CREATE INDEX "AuditLog_jobId_idx" ON "public"."AuditLog"("jobId");

-- AddForeignKey
ALTER TABLE "public"."Job" ADD CONSTRAINT "Job_importerId_fkey" FOREIGN KEY ("importerId") REFERENCES "public"."Importer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Job" ADD CONSTRAINT "Job_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."ShippingAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "public"."Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
