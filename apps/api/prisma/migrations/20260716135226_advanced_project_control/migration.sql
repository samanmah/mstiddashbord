-- CreateEnum
CREATE TYPE "WbsNodeType" AS ENUM ('PROJECT', 'PHASE', 'BREAK1', 'WORK_PACKAGE', 'SUMMARY_TASK', 'TASK', 'MILESTONE', 'DELIVERABLE');

-- CreateEnum
CREATE TYPE "WeightSource" AS ENUM ('EXPLICIT', 'MPP_CUSTOM_FIELD', 'COST_DERIVED', 'DURATION_DERIVED', 'EQUAL_DERIVED', 'NONE');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('FS', 'SS', 'FF', 'SF');

-- CreateEnum
CREATE TYPE "DependencySource" AS ENUM ('EXCEL', 'MPP', 'MANUAL');

-- CreateEnum
CREATE TYPE "AssignmentRole" AS ENUM ('OWNER', 'RESPONSIBLE', 'ACCOUNTABLE', 'CONSULTED', 'INFORMED', 'REVIEWER', 'APPROVER');

-- CreateEnum
CREATE TYPE "ControlNodeStatus" AS ENUM ('NOT_STARTED', 'ON_TRACK', 'AT_RISK', 'DELAYED', 'BLOCKED', 'COMPLETED', 'CANCELLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ControlPeriodUnit" AS ENUM ('DAY', 'WEEK', 'MONTH', 'QUARTER');

-- CreateEnum
CREATE TYPE "ControlImportSourceType" AS ENUM ('EXCEL', 'MPP');

-- CreateEnum
CREATE TYPE "ControlImportStatus" AS ENUM ('UPLOADED', 'PARSING', 'PARSED', 'MAPPING', 'VALIDATED', 'DRY_RUN', 'COMMITTING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportMatchStatus" AS ENUM ('UNMATCHED', 'AUTO_MATCHED', 'MANUAL_MATCHED', 'AMBIGUOUS', 'CONFLICT', 'IGNORED');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "activeControlPlanId" UUID,
ADD COLUMN     "controlCurrency" TEXT,
ADD COLUMN     "controlStatusDate" DATE,
ADD COLUMN     "controlVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "projectControlEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "risks" ADD COLUMN     "phaseNodeId" UUID,
ADD COLUMN     "wbsNodeId" UUID;

-- AlterTable
ALTER TABLE "decisions" ADD COLUMN     "phaseNodeId" UUID,
ADD COLUMN     "wbsNodeId" UUID;

-- CreateTable
CREATE TABLE "project_control_plans" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "statusDate" DATE NOT NULL,
    "scheduleStart" DATE,
    "scheduleFinish" DATE,
    "baselineId" UUID,
    "periodUnit" "ControlPeriodUnit" NOT NULL DEFAULT 'MONTH',
    "periodCount" INTEGER,
    "totalDurationDays" INTEGER,
    "totalDurationMonths" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tehran',
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID,
    "updatedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_control_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wbs_nodes" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "controlPlanId" UUID NOT NULL,
    "parentId" UUID,
    "code" TEXT,
    "externalUid" TEXT,
    "sourceRow" INTEGER,
    "sourceFileType" TEXT,
    "sourceFileHash" TEXT,
    "sourceRawTitle" TEXT,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "description" TEXT,
    "depth" INTEGER NOT NULL,
    "outlineNumber" TEXT,
    "materializedPath" TEXT NOT NULL,
    "nodeType" "WbsNodeType" NOT NULL DEFAULT 'TASK',
    "isSummary" BOOLEAN NOT NULL DEFAULT false,
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "plannedStart" DATE,
    "plannedFinish" DATE,
    "actualStart" DATE,
    "actualFinish" DATE,
    "forecastFinish" DATE,
    "baselineStart" DATE,
    "baselineFinish" DATE,
    "deadline" DATE,
    "plannedDurationMinutes" INTEGER,
    "actualDurationMinutes" INTEGER,
    "remainingDurationMinutes" INTEGER,
    "periodPlanStart" INTEGER,
    "periodPlanDuration" INTEGER,
    "periodActualStart" INTEGER,
    "periodActualDuration" INTEGER,
    "percentComplete" DOUBLE PRECISION,
    "physicalProgress" DOUBLE PRECISION,
    "plannedProgressOverride" DOUBLE PRECISION,
    "financialProgress" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "weightSource" "WeightSource" NOT NULL DEFAULT 'NONE',
    "budgetAmount" DECIMAL(20,2),
    "mppCost" DECIMAL(20,2),
    "baselineCost" DECIMAL(20,2),
    "actualCost" DECIMAL(20,2),
    "workMinutes" INTEGER,
    "actualWorkMinutes" INTEGER,
    "remainingWorkMinutes" INTEGER,
    "ownerText" TEXT,
    "definitionOfDone" TEXT,
    "notes" TEXT,
    "statusOverride" "ControlNodeStatus",
    "constraintType" TEXT,
    "constraintDate" DATE,
    "calendarName" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wbs_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "controlPlanId" UUID NOT NULL,
    "predecessorNodeId" UUID NOT NULL,
    "successorNodeId" UUID NOT NULL,
    "type" "DependencyType" NOT NULL DEFAULT 'FS',
    "lagMinutes" INTEGER NOT NULL DEFAULT 0,
    "source" "DependencySource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_assignments" (
    "id" UUID NOT NULL,
    "nodeId" UUID NOT NULL,
    "userId" UUID,
    "externalResourceName" TEXT,
    "role" "AssignmentRole" NOT NULL DEFAULT 'OWNER',
    "allocationPercent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_updates" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "nodeId" UUID NOT NULL,
    "reportingDate" DATE NOT NULL,
    "actualPercent" DOUBLE PRECISION NOT NULL,
    "physicalProgress" DOUBLE PRECISION,
    "financialProgress" DOUBLE PRECISION,
    "actualCost" DECIMAL(20,2),
    "remainingDurationMinutes" INTEGER,
    "forecastFinish" DATE,
    "status" "ControlNodeStatus" NOT NULL DEFAULT 'UNKNOWN',
    "comment" TEXT,
    "evidenceUrl" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_baselines" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "controlPlanId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "baselineNumber" INTEGER NOT NULL,
    "statusDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baseline_node_snapshots" (
    "id" UUID NOT NULL,
    "baselineId" UUID NOT NULL,
    "nodeId" UUID NOT NULL,
    "plannedStart" DATE,
    "plannedFinish" DATE,
    "plannedDurationMinutes" INTEGER,
    "budgetAmount" DECIMAL(20,2),
    "weight" DOUBLE PRECISION,
    "percentCompleteAtBaseline" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baseline_node_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "controlPlanId" UUID,
    "sourceType" "ControlImportSourceType" NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "status" "ControlImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "warningRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "validationReport" JSONB,
    "mappingReport" JSONB,
    "importedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_source_records" (
    "id" UUID NOT NULL,
    "importBatchId" UUID NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "sourceUid" TEXT,
    "rawData" JSONB NOT NULL,
    "normalizedData" JSONB NOT NULL,
    "matchedNodeId" UUID,
    "matchStatus" "ImportMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_source_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_schedule_snapshots" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "controlPlanId" UUID NOT NULL,
    "reportingDate" DATE NOT NULL,
    "plannedPercent" DOUBLE PRECISION NOT NULL,
    "actualPercent" DOUBLE PRECISION NOT NULL,
    "physicalPercent" DOUBLE PRECISION NOT NULL,
    "financialPercent" DOUBLE PRECISION,
    "plannedValue" DECIMAL(20,2),
    "earnedValue" DECIMAL(20,2),
    "actualCost" DECIMAL(20,2),
    "spi" DOUBLE PRECISION,
    "cpi" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_schedule_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_control_plans_projectId_idx" ON "project_control_plans"("projectId");

-- CreateIndex
CREATE INDEX "project_control_plans_projectId_isActive_idx" ON "project_control_plans"("projectId", "isActive");

-- CreateIndex
CREATE INDEX "project_control_plans_statusDate_idx" ON "project_control_plans"("statusDate");

-- CreateIndex
CREATE INDEX "wbs_nodes_projectId_idx" ON "wbs_nodes"("projectId");

-- CreateIndex
CREATE INDEX "wbs_nodes_controlPlanId_idx" ON "wbs_nodes"("controlPlanId");

-- CreateIndex
CREATE INDEX "wbs_nodes_parentId_idx" ON "wbs_nodes"("parentId");

-- CreateIndex
CREATE INDEX "wbs_nodes_controlPlanId_parentId_idx" ON "wbs_nodes"("controlPlanId", "parentId");

-- CreateIndex
CREATE INDEX "wbs_nodes_controlPlanId_sortOrder_idx" ON "wbs_nodes"("controlPlanId", "sortOrder");

-- CreateIndex
CREATE INDEX "wbs_nodes_materializedPath_idx" ON "wbs_nodes"("materializedPath");

-- CreateIndex
CREATE INDEX "wbs_nodes_nodeType_idx" ON "wbs_nodes"("nodeType");

-- CreateIndex
CREATE INDEX "wbs_nodes_externalUid_idx" ON "wbs_nodes"("externalUid");

-- CreateIndex
CREATE INDEX "wbs_nodes_deletedAt_idx" ON "wbs_nodes"("deletedAt");

-- CreateIndex
CREATE INDEX "task_dependencies_projectId_idx" ON "task_dependencies"("projectId");

-- CreateIndex
CREATE INDEX "task_dependencies_controlPlanId_idx" ON "task_dependencies"("controlPlanId");

-- CreateIndex
CREATE INDEX "task_dependencies_predecessorNodeId_idx" ON "task_dependencies"("predecessorNodeId");

-- CreateIndex
CREATE INDEX "task_dependencies_successorNodeId_idx" ON "task_dependencies"("successorNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_predecessorNodeId_successorNodeId_type_key" ON "task_dependencies"("predecessorNodeId", "successorNodeId", "type");

-- CreateIndex
CREATE INDEX "node_assignments_nodeId_idx" ON "node_assignments"("nodeId");

-- CreateIndex
CREATE INDEX "node_assignments_userId_idx" ON "node_assignments"("userId");

-- CreateIndex
CREATE INDEX "progress_updates_projectId_idx" ON "progress_updates"("projectId");

-- CreateIndex
CREATE INDEX "progress_updates_nodeId_idx" ON "progress_updates"("nodeId");

-- CreateIndex
CREATE INDEX "progress_updates_nodeId_reportingDate_idx" ON "progress_updates"("nodeId", "reportingDate");

-- CreateIndex
CREATE INDEX "progress_updates_reportingDate_idx" ON "progress_updates"("reportingDate");

-- CreateIndex
CREATE INDEX "project_baselines_projectId_idx" ON "project_baselines"("projectId");

-- CreateIndex
CREATE INDEX "project_baselines_controlPlanId_idx" ON "project_baselines"("controlPlanId");

-- CreateIndex
CREATE INDEX "project_baselines_controlPlanId_isActive_idx" ON "project_baselines"("controlPlanId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "project_baselines_controlPlanId_baselineNumber_key" ON "project_baselines"("controlPlanId", "baselineNumber");

-- CreateIndex
CREATE INDEX "baseline_node_snapshots_baselineId_idx" ON "baseline_node_snapshots"("baselineId");

-- CreateIndex
CREATE INDEX "baseline_node_snapshots_nodeId_idx" ON "baseline_node_snapshots"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "baseline_node_snapshots_baselineId_nodeId_key" ON "baseline_node_snapshots"("baselineId", "nodeId");

-- CreateIndex
CREATE INDEX "import_batches_projectId_idx" ON "import_batches"("projectId");

-- CreateIndex
CREATE INDEX "import_batches_controlPlanId_idx" ON "import_batches"("controlPlanId");

-- CreateIndex
CREATE INDEX "import_batches_fileHash_idx" ON "import_batches"("fileHash");

-- CreateIndex
CREATE INDEX "import_batches_status_idx" ON "import_batches"("status");

-- CreateIndex
CREATE INDEX "import_batches_createdAt_idx" ON "import_batches"("createdAt");

-- CreateIndex
CREATE INDEX "import_source_records_importBatchId_idx" ON "import_source_records"("importBatchId");

-- CreateIndex
CREATE INDEX "import_source_records_matchedNodeId_idx" ON "import_source_records"("matchedNodeId");

-- CreateIndex
CREATE INDEX "import_source_records_matchStatus_idx" ON "import_source_records"("matchStatus");

-- CreateIndex
CREATE INDEX "project_schedule_snapshots_projectId_idx" ON "project_schedule_snapshots"("projectId");

-- CreateIndex
CREATE INDEX "project_schedule_snapshots_controlPlanId_idx" ON "project_schedule_snapshots"("controlPlanId");

-- CreateIndex
CREATE INDEX "project_schedule_snapshots_reportingDate_idx" ON "project_schedule_snapshots"("reportingDate");

-- CreateIndex
CREATE UNIQUE INDEX "project_schedule_snapshots_controlPlanId_reportingDate_key" ON "project_schedule_snapshots"("controlPlanId", "reportingDate");

-- CreateIndex
CREATE INDEX "projects_projectControlEnabled_idx" ON "projects"("projectControlEnabled");

-- CreateIndex
CREATE INDEX "risks_phaseNodeId_idx" ON "risks"("phaseNodeId");

-- CreateIndex
CREATE INDEX "risks_wbsNodeId_idx" ON "risks"("wbsNodeId");

-- CreateIndex
CREATE INDEX "decisions_phaseNodeId_idx" ON "decisions"("phaseNodeId");

-- CreateIndex
CREATE INDEX "decisions_wbsNodeId_idx" ON "decisions"("wbsNodeId");

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_phaseNodeId_fkey" FOREIGN KEY ("phaseNodeId") REFERENCES "wbs_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "wbs_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_phaseNodeId_fkey" FOREIGN KEY ("phaseNodeId") REFERENCES "wbs_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_wbsNodeId_fkey" FOREIGN KEY ("wbsNodeId") REFERENCES "wbs_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_control_plans" ADD CONSTRAINT "project_control_plans_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_nodes" ADD CONSTRAINT "wbs_nodes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_nodes" ADD CONSTRAINT "wbs_nodes_controlPlanId_fkey" FOREIGN KEY ("controlPlanId") REFERENCES "project_control_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_nodes" ADD CONSTRAINT "wbs_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "wbs_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_controlPlanId_fkey" FOREIGN KEY ("controlPlanId") REFERENCES "project_control_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_predecessorNodeId_fkey" FOREIGN KEY ("predecessorNodeId") REFERENCES "wbs_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_successorNodeId_fkey" FOREIGN KEY ("successorNodeId") REFERENCES "wbs_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_assignments" ADD CONSTRAINT "node_assignments_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "wbs_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_updates" ADD CONSTRAINT "progress_updates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_updates" ADD CONSTRAINT "progress_updates_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "wbs_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_baselines" ADD CONSTRAINT "project_baselines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_baselines" ADD CONSTRAINT "project_baselines_controlPlanId_fkey" FOREIGN KEY ("controlPlanId") REFERENCES "project_control_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline_node_snapshots" ADD CONSTRAINT "baseline_node_snapshots_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "project_baselines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline_node_snapshots" ADD CONSTRAINT "baseline_node_snapshots_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "wbs_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_controlPlanId_fkey" FOREIGN KEY ("controlPlanId") REFERENCES "project_control_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_source_records" ADD CONSTRAINT "import_source_records_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_source_records" ADD CONSTRAINT "import_source_records_matchedNodeId_fkey" FOREIGN KEY ("matchedNodeId") REFERENCES "wbs_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_schedule_snapshots" ADD CONSTRAINT "project_schedule_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_schedule_snapshots" ADD CONSTRAINT "project_schedule_snapshots_controlPlanId_fkey" FOREIGN KEY ("controlPlanId") REFERENCES "project_control_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

