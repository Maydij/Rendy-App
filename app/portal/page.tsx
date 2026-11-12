import React from 'react';
import { MessageSquare, ShieldCheck, CheckCircle2, XCircle, Receipt, LogOut } from 'lucide-react';
import { requireAuthenticatedSession } from '@/lib/auth/session-context';
import { supabaseServer } from '@/lib/supabase-server';
import { logoutAction } from '@/app/actions/auth.actions';
import { serverEnv } from '@/lib/security/env';

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<string, string> = {
  ALIMENTACION: 'Alimentación',
  TRANSPORTE: 'Transporte y Combustible',
  HOSPEDAJE: 'Hospedaje y Hoteles',
  REPRESENTACION: 'Gastos de Representación',
  OTROS: 'Otros Gastos Operativos',
};

/**
 * @name EmployeePortalPage
 * @description [Business Logic]: Dedicated, role-isolated workspace for company employees
 * (`role === 'EMPLOYEE'`). Displays their authorized expense categories, personal submission
 * history, and direct launch button to the WhatsApp OCR receipt bot.
 */
export default async function EmployeePortalPage() {
  const session = await requireAuthenticatedSession();

  const [{ data: user }, { data: company }, { data: myExpenses }] = await Promise.all([
    supabaseServer
      .from('usuarios')
      .select('id, nombre, email, department, allowed_expense_categories')
      .eq('id', session.userId)
      .eq('empresa_id', session.empresaId)
      .single(),
    supabaseServer
      .from('empresas')
      .select('nombre')
      .eq('id', session.empresaId)
      .single(),
    supabaseServer
      .from('gastos')
      .select('id, fecha_gasto, comercio, categoria, monto_usd, estado, es_reembolso')
      .eq('empresa_id', session.empresaId)
      .eq('usuario_id', session.userId)
      .order('creado_en', { ascending: false })
      .limit(20),
  ]);

  const categories = (user?.allowed_expense_categories as Record<string, boolean> | null) ?? {};
  const whatsappUrl = `https://wa.me/${serverEnv.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER}?text=${encodeURIComponent(
    'Hola Rendy, quiero registrar un gasto'
  )}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              {company?.nombre || 'Organización'} • Portal del Colaborador
            </span>
            <h1 className="text-lg font-bold text-white">
              Hola, {user?.nombre || 'Colaborador'}
            </h1>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Direct WhatsApp Bot Action Banner */}
        <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/60 to-slate-900 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Canal Cifrado Vinculado</span>
            </div>
            <h2 className="text-base font-bold text-white">
              Reporta tus comprobantes en segundos por WhatsApp
            </h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Envía una foto de tu factura o ticket al asistente oficial de Rendy. Nuestro motor OCR
              extraerá automáticamente los datos fiscales y calculará tu reembolso o viático.
            </p>
          </div>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition shrink-0"
          >
            <MessageSquare className="h-4 w-4" />
            Abrir Bot de WhatsApp
          </a>
        </section>

        {/* Authorized Expense Categories */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">
              Categorías de Gastos y Reembolsos Autorizadas
            </h3>
            <p className="text-xs text-slate-400">
              Departamento: <strong className="text-slate-200">{user?.department || 'General'}</strong>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
              const isAllowed = Boolean(categories[key]);
              return (
                <div
                  key={key}
                  className={`rounded-xl border p-3 flex items-center justify-between ${
                    isAllowed
                      ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-300'
                      : 'border-slate-800 bg-slate-950/60 text-slate-500'
                  }`}
                >
                  <span className="text-xs font-medium">{label}</span>
                  {isAllowed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-slate-600 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Recent Personal Submissions */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Mis Últimos Gastos y Reembolsos</h3>
          </div>

          {!myExpenses || myExpenses.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Aún no has enviado comprobantes. Usa el botón de WhatsApp superior para registrar tu primer gasto.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Comercio</th>
                    <th className="py-2.5 px-3">Categoría</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3 text-right">Monto (USD)</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {myExpenses.map((exp) => (
                    <tr key={exp.id}>
                      <td className="py-2.5 px-3 text-slate-300">{exp.fecha_gasto}</td>
                      <td className="py-2.5 px-3 font-medium text-white">{exp.comercio}</td>
                      <td className="py-2.5 px-3 text-slate-300">{exp.categoria}</td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {exp.es_reembolso ? 'Reembolso' : 'Viático'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-400">
                        ${Number(exp.monto_usd || 0).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-200">
                          {exp.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}