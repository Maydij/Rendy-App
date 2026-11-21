// app/invitacion/[token]/page.tsx
import React from 'react';
import { getInvitationPreviewAction } from '@/app/actions/invitations.actions';
import { ConfigurarContrasenaClient } from '@/components/auth/ConfigurarContrasenaClient';

export const dynamic = 'force-dynamic';

interface InvitationPageProps {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ code?: string }>;
}

/**
 * @name EmployeeInvitationPage
 * @description [Business Logic]: Single-use cryptographic magic link onboarding landing page.
 * Invited staff configure their password, verify temporary credentials, and activate their
 * Rendy corporate profile.
 */
export default async function EmployeeInvitationPage({ params, searchParams }: InvitationPageProps) {
  const { token } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialCode = resolvedSearchParams?.code || '';

  const preview = await getInvitationPreviewAction(token);

  return (
    <ConfigurarContrasenaClient
      token={token}
      initialCode={initialCode}
      firstName={preview.firstName || ''}
      lastName={preview.lastName || ''}
      email={preview.email || ''}
      department={preview.department || 'Colaborador'}
      companyName={preview.companyName || 'tu empresa'}
      initialStatusReason={preview.statusReason}
      initialError={preview.error}
      tempPasswordSample={preview.tempPasswordSample}
    />
  );
}
