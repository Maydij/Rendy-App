// components/dashboard/DashboardInteractiveShell.tsx
'use client';

import React, { useState } from 'react';
import { FtuxOnboardingChecklist } from './FtuxOnboardingChecklist';
import { InviteEmployeeModal } from './InviteEmployeeModal';
import type { FtuxState } from '@/app/actions/ftux.actions';
import { useFeatureDwellTime } from '@/lib/hooks/useFeatureDwellTime';

interface DashboardInteractiveShellProps {
  companyName: string;
  ftuxState: FtuxState;
}

/**
 * @name DashboardInteractiveShell
 * @description [Business Logic]: Client-side coordinator for the Administrator Dashboard FTUX
 * checklist, Employee Invitation Modal with QR generation, and active dwell-time telemetry.
 */
export function DashboardInteractiveShell({
  companyName,
  ftuxState,
}: DashboardInteractiveShellProps) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  useFeatureDwellTime('DASHBOARD_OVERVIEW', 'ADMIN');

  return (
    <div style={{ marginBottom: '24px' }}>
      <FtuxOnboardingChecklist
        companyName={companyName}
        initialState={ftuxState}
        onOpenInviteEmployeeModal={() => setIsInviteModalOpen(true)}
      />

      <InviteEmployeeModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </div>
  );
}