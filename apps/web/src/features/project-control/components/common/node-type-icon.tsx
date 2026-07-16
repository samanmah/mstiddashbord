'use client';

import {
  Diamond,
  Folder,
  FolderTree,
  Layers,
  ListTodo,
  PackageCheck,
  Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WbsNodeType } from '../../api/project-control-types';

const ICONS: Record<WbsNodeType, LucideIcon> = {
  PROJECT: FolderTree,
  PHASE: Layers,
  BREAK1: Folder,
  WORK_PACKAGE: PackageCheck,
  SUMMARY_TASK: Folder,
  TASK: ListTodo,
  MILESTONE: Diamond,
  DELIVERABLE: Target,
};

const COLORS: Record<WbsNodeType, string> = {
  PROJECT: 'text-navy-900',
  PHASE: 'text-brand-blue',
  BREAK1: 'text-brand-purple',
  WORK_PACKAGE: 'text-brand-green',
  SUMMARY_TASK: 'text-grayx-header',
  TASK: 'text-grayx-header',
  MILESTONE: 'text-brand-orange',
  DELIVERABLE: 'text-brand-green',
};

export function NodeTypeIcon({
  type,
  className,
}: {
  type: WbsNodeType;
  className?: string;
}): React.JSX.Element {
  const Icon = ICONS[type] ?? ListTodo;
  return <Icon className={className ?? `h-4 w-4 ${COLORS[type] ?? ''}`} aria-hidden />;
}
