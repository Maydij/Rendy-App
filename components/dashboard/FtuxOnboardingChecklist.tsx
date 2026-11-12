'use client';

import React, { useState, useTransition } from 'react';
import {
  CheckCircle2,
  Circle,
  Calendar,
  FileSpreadsheet,
  UserPlus,
  Sparkles,
  X,
} from 'lucide-react';
import { updateFtuxChecklistAction, type FtuxState } from '@/app/actions/ftux.actions';
import { trackProductEvent } from '@/lib/analytics/tracking-plan';

interface FtuxOnboardingChecklistProps {
  companyName: string;
  initialState: FtuxState;
  onOpenInviteEmployeeModal: () => void;
}

const ACCOUNTING_TEMPLATES = [
  { id: 'VEN_SENIAT' as const, label: 'Venezuela (SENIAT • IVA 16% + IGTF 3%)' },
  { id: 'MEX_SAT' as const, label: 'México (SAT • CFDI + IVA 16%)' },
  { id: 'COL_DIAN' as const, label: 'Colombia (DIAN • IVA 19% + INC)' },
  { id: 'INTL_IFRS' as const, label: 'Internacional (USD • Estándar IFRS)' },
];

/**
 * @name FtuxOnboardingChecklist
 * @description [Business Logic]: Interactive First-Time User Experience (FTUX) empty-state
 * guide for new Project Administrators. Guides step-by-step setup of accounting templates,
 * onboarding calls, and initial employee invitations.
 */
export function FtuxOnboardingChecklist({
  companyName,
  initialState,
  onOpenInviteEmployeeModal,
}: FtuxOnboardingChecklistProps) {
  const [state, setState] = useState<FtuxState>(initialState);
  const [selectedTemplate, setSelectedTemplate] = useState<
    'VEN_SENIAT' | 'MEX_SAT' | 'COL_DIAN' | 'INTL_IFRS'
  >('VEN_SENIAT');
  const [isPending, startTransition] = useTransition();

  if (state.checklist_dismissed) return null;

  const step1Done = Boolean(state.accounting_template_selected || state.setup_call_scheduled);
  const step2Done = Boolean(state.first_employee_invited);
  const completedCount = (step1Done ? 1 : 0) + (step2Done ? 1 : 0);

  const handleSaveTemplate = () => {
    startTransition(async () => {
      const res = await updateFtuxChecklistAction({
        accountingTemplate: selectedTemplate,
      });
      if (res.success && res.state) {
        setState(res.state);
        void trackProductEvent('ftux_checklist_completed', {
          action_type: 'ACCOUNTING_TEMPLATE',
          total_completed_count: res.state.first_employee_invited ? 2 : 1,
        });
      }
    });
  };

  const handleScheduleCall = () => {
    startTransition(async () => {
      const res = await updateFtuxChecklistAction({ setupCallScheduled: true });
      if (res.success && res.state) {
        setState(res.state);
        void trackProductEvent('ftux_checklist_completed', {
          action_type: 'SCHEDULE_SETUP_CALL',
          total_completed_count: res.state.first_employee_invited ? 2 : 1,
        });
      }
    });
  };

  const handleDismiss = () => {
    startTransition(async () => {
      const res = await updateFtuxChecklistAction({ dismissChecklist: true });
      if (res.success && res.state) {
        setState(res.state);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-6 shadow-xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">
                Bienvenido a Rendy, {companyName}
              </h2>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                Prueba de 7 días activa • {completedCount}/2 pasos
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Completa estos dos pasos iniciales para comenzar a recibir y auditar gastos por WhatsApp.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          disabled={isPending}
          title="Ocultar guía inicial"
          className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Step 1: Accounting Template OR Setup Call */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            {step1Done ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-slate-500 shrink-0" />
            )}
            <h3 className="text-sm font-bold text-white">
              1. Plantilla Contable o Llamada de Configuración
            </h3>
          </div>

          <p className="text-xs text-slate-400">
            Selecciona el marco tributario de tu empresa o agenda una sesión 1-a-1 con un especialista.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedTemplate}
              onChange={(e) =>
                setSelectedTemplate(
                  e.target.value as 'VEN_SENIAT' | 'MEX_SAT' | 'COL_DIAN' | 'INTL_IFRS'
                )
              }
              disabled={isPending}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none"
            >
              {ACCOUNTING_TEMPLATES.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Aplicar Plantilla
            </button>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={handleScheduleCall}
              disabled={isPending || state.setup_call_scheduled}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-60 cursor-pointer"
            >
              <Calendar className="h-3.5 w-3.5" />
              {state.setup_call_scheduled
                ? 'Llamada de configuración solicitada ✓'
                : 'O agendar llamada guiada de 15 min →'}
            </button>
          </div>
        </div>

        {/* Step 2: Invite Employees */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              {step2Done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-slate-500 shrink-0" />
              )}
              <h3 className="text-sm font-bold text-white">
                2. Alta e Invitación de Empleados
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Registra a tus colaboradores, define qué categorías de gastos tienen permitidas y
              genera su enlace mágico o código QR para activar el bot de WhatsApp.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={onOpenInviteEmployeeModal}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white transition cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              Invitar Empleados Ahora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}