'use client';

import { StatusBadge } from '@/components/ui/badge';
import type { ControlNodeStatus } from '../../api/project-control-types';
import { statusLabel, statusTone } from '../../utils/control-status';

export function ControlStatusBadge({
  status,
}: {
  status: ControlNodeStatus | null | undefined;
}): React.JSX.Element {
  return <StatusBadge tone={statusTone(status)} label={statusLabel(status)} />;
}
