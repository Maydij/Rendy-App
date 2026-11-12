// app/invitacion/[token]/page.tsx
import React from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { getInvitationPreviewAction } from '@/app/actions/invitations.actions';
import { AcceptInvitationForm } from '@/components/auth/AcceptInvitationForm';

export const dynamic = 'force-dynamic';

interface InvitationPageProps {
  params: Promise<{ token: string }>;
}

/**
 * @name EmployeeInvitationPage
 * @description [Business Logic]: Single-use cryptographic magic link landing page where
 * invited employees verify their organization link, configure their Argon2id password,
 * and obtain direct instructions to interact with the Rendy WhatsApp bot.
 */
export default async function EmployeeInvitationPage({ params }: InvitationPageProps) {
  const { token } = await params;
  const preview = await getInvitationPreviewAction(token);

  if (!preview.valid) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-slate-900 p-8 text-center space-y-4 shadow-2xl">
          <div className="h-12 w-12 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-white">Enlace de Invitación No Válido</h1>
          <p className="text-xs text-slate-400 leading-relaxed">{preview.error}</p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-xs font-bold text-white transition"
            >
              Ir al Inicio de Sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <AcceptInvitationForm
        token={token}
        firstName={preview.firstName || ''}
        lastName={preview.lastName || ''}
        email={preview.email || ''}
        department={preview.department || 'General'}
        companyName={preview.companyName || 'tu empresa'}
      />
    </div>
  );
}