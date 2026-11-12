'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Lock,
  MessageSquare,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { acceptEmployeeInvitationAction } from '@/app/actions/invitations.actions';

interface AcceptInvitationFormProps {
  token: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  companyName: string;
}

/**
 * @name AcceptInvitationForm
 * @description [Business Logic]: Interactive employee activation card allowing invited staff
 * to confirm their corporate affiliation, create a strong password, and launch the WhatsApp bot.
 */
export function AcceptInvitationForm({
  token,
  firstName,
  lastName,
  email,
  department,
  companyName,
}: AcceptInvitationFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activationResult, setActivationResult] = useState<{
    whatsappBotUrl: string;
    companyName: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleActivate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      const res = await acceptEmployeeInvitationAction({
        token,
        password,
        confirmPassword,
      });

      if (!res.success || !res.whatsappBotUrl) {
        setErrorMsg(res.error || 'No se pudo completar la activación.');
        return;
      }

      setActivationResult({
        whatsappBotUrl: res.whatsappBotUrl,
        companyName: res.companyName || companyName,
      });
    });
  };

  if (activationResult) {
    return (
      <div className="max-w-lg w-full rounded-2xl border border-emerald-500/30 bg-slate-900 p-8 space-y-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">¡Cuenta Activada con Éxito!</h1>
            <p className="text-xs text-emerald-400">
              Vinculado a {activationResult.companyName}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-2.5 text-xs text-slate-300">
          <p className="font-bold text-white">¿Cómo registrar tus gastos por WhatsApp?</p>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
            <li>Presiona el botón verde inferior para abrir el chat oficial de Rendy.</li>
            <li>Envía una foto clara de tu factura, recibo o comprobante de pago.</li>
            <li>Confirma los datos extraídos automáticamente por nuestra IA.</li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href={activationResult.whatsappBotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-3 text-xs font-bold text-white shadow-lg transition"
          >
            <MessageSquare className="h-4 w-4" />
            Abrir Bot de WhatsApp
          </a>

          <button
            type="button"
            onClick={() => router.push('/portal')}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-3 text-xs font-semibold text-white transition cursor-pointer"
          >
            <span>Ir a mi Portal</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 space-y-6 shadow-2xl">
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
          <ShieldCheck className="h-4 w-4" />
          <span>Invitación Corporativa Verificada</span>
        </div>
        <h1 className="text-xl font-bold text-white">
          Hola {firstName} {lastName}
        </h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          Has sido invitado a unirte a <strong className="text-white">{companyName}</strong> en el
          departamento de <strong className="text-slate-200">{department}</strong> ({email}).
          Crea tu contraseña para activar tu cuenta.
        </p>
      </div>

      <form onSubmit={handleActivate} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Nueva Contraseña (mín. 12 caracteres, mayúscula, número y símbolo)
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Confirmar Contraseña
          </label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
          />
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-3 px-5 text-sm font-bold text-white transition flex items-center justify-center gap-2 shadow-lg cursor-pointer"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Activando cuenta cifrada...</span>
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              <span>Confirmar Vinculación y Activar Cuenta</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}