-- CreateEnum
CREATE TYPE "PeriodValueType" AS ENUM ('PLANNED', 'ACTUAL', 'UNKNOWN');

-- CreateTable
CREATE TABLE "control_period_columns" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "controlPlanId" UUID NOT NULL,
    "columnIndex" INTEGER NOT NULL,
    "columnLetter" TEXT NOT NULL,
    "periodIndex" INTEGER NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "periodGroup" TEXT,
    "valueType" "PeriodValueType" NOT NULL DEFAULT 'UNKNOWN',
    "reportingDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "control_period_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_period_snapshots" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "controlPlanId" UUID NOT NULL,
    "nodeId" UUID NOT NULL,
    "importBatchId" UUID,
    "periodIndex" INTEGER NOT NULL,
    "periodLabel" TEXT,
    "reportingDate" DATE,
    "valueType" "PeriodValueType" NOT NULL,
    "plannedValue" DOUBLE PRECISION,
    "actualValue" DOUBLE PRECISION,
    "normalizedValue" DOUBLE PRECISION,
    "sourceRow" INTEGER,
    "sourceColumn" INTEGER,
    "zeroIsExplicit" BOOLEAN NOT NULL DEFAULT false,
    "rawValue" TEXT,
    "formula" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_period_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "control_period_columns_projectId_idx" ON "control_period_columns"("projectId");

-- CreateIndex
CREATE INDEX "control_period_columns_controlPlanId_idx" ON "control_period_columns"("controlPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "control_period_columns_controlPlanId_columnIndex_key" ON "control_period_columns"("controlPlanId", "columnIndex");

-- CreateIndex
CREATE INDEX "control_period_columns_controlPlanId_periodIndex_idx" ON "control_period_columns"("controlPlanId", "periodIndex");

-- CreateIndex
CREATE INDEX "node_period_snapshots_projectId_idx" ON "node_period_snapshots"("projectId");

-- CreateIndex
CREATE INDEX "node_period_snapshots_controlPlanId_idx" ON "node_period_snapshots"("controlPlanId");

-- CreateIndex
CREATE INDEX "node_period_snapshots_nodeId_idx" ON "node_period_snapshots"("nodeId");

-- CreateIndex
CREATE INDEX "node_period_snapshots_reportingDate_idx" ON "node_period_snapshots"("reportingDate");

-- CreateIndex
CREATE INDEX "node_period_snapshots_importBatchId_idx" ON "node_period_snapshots"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "node_period_snapshots_controlPlanId_nodeId_periodIndex_valueType_key" ON "node_period_snapshots"("controlPlanId", "nodeId", "periodIndex", "valueType");

-- AddForeignKey
ALTER TABLE "control_period_columns" ADD CONSTRAINT "control_period_columns_controlPlanId_fkey" FOREIGN KEY ("controlPlanId") REFERENCES "project_control_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_period_snapshots" ADD CONSTRAINT "node_period_snapshots_controlPlanId_fkey" FOREIGN KEY ("controlPlanId") REFERENCES "project_control_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_period_snapshots" ADD CONSTRAINT "node_period_snapshots_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "wbs_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
