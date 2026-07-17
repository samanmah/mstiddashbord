-- CreateEnum
CREATE TYPE "PeriodAxisType" AS ENUM ('ORDINAL', 'CALENDAR_DAY', 'CALENDAR_WEEK', 'CALENDAR_MONTH');

-- CreateEnum
CREATE TYPE "GanttSpanType" AS ENUM ('PLANNED', 'ACTUAL', 'PROGRESS', 'DELAY', 'OTHER');

-- CreateEnum
CREATE TYPE "GanttDerivationMethod" AS ENUM ('EXCEL_CONDITIONAL_FORMATTING', 'EXPLICIT_PERIOD_VALUE', 'MANUAL');

-- AlterTable ControlPeriodColumn (ControlPlanPeriod equivalent)
ALTER TABLE "control_period_columns" ADD COLUMN "axisType" "PeriodAxisType" NOT NULL DEFAULT 'ORDINAL';
ALTER TABLE "control_period_columns" ADD COLUMN "calendarStart" DATE;
ALTER TABLE "control_period_columns" ADD COLUMN "calendarEnd" DATE;
ALTER TABLE "control_period_columns" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Unique periodIndex per plan (ordinal axis 1..N)
CREATE UNIQUE INDEX "control_period_columns_controlPlanId_periodIndex_key" ON "control_period_columns"("controlPlanId", "periodIndex");

-- CreateTable NodeGanttSpan
CREATE TABLE "node_gantt_spans" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "controlPlanId" UUID NOT NULL,
    "nodeId" UUID NOT NULL,
    "spanType" "GanttSpanType" NOT NULL,
    "startPeriodIndex" INTEGER NOT NULL,
    "endPeriodIndex" INTEGER NOT NULL,
    "progressEndPeriodIndex" INTEGER,
    "sourceRow" INTEGER,
    "derivationMethod" "GanttDerivationMethod" NOT NULL DEFAULT 'EXCEL_CONDITIONAL_FORMATTING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_gantt_spans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "node_gantt_spans_projectId_idx" ON "node_gantt_spans"("projectId");
CREATE INDEX "node_gantt_spans_controlPlanId_idx" ON "node_gantt_spans"("controlPlanId");
CREATE INDEX "node_gantt_spans_nodeId_idx" ON "node_gantt_spans"("nodeId");
CREATE UNIQUE INDEX "node_gantt_spans_controlPlanId_nodeId_spanType_key" ON "node_gantt_spans"("controlPlanId", "nodeId", "spanType");

ALTER TABLE "node_gantt_spans" ADD CONSTRAINT "node_gantt_spans_controlPlanId_fkey" FOREIGN KEY ("controlPlanId") REFERENCES "project_control_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "node_gantt_spans" ADD CONSTRAINT "node_gantt_spans_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "wbs_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
