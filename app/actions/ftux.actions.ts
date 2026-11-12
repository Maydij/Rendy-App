// app/actions/ftux.actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase-server';
import { requireAdminSession } from '@/lib/auth/session-context';

export interface FtuxState {
  accounting_template_selected: string | null;
  setup_call_scheduled: boolean;
  first_employee_invited: boolean;
  checklist_dismissed: boolean;
}

const UpdateFtuxSchema = z
  .object({
    accountingTemplate: z
      .enum(['VEN_SENIAT', 'MEX_SAT', 'COL_DIAN', 'INTL_IFRS'])
      .optional(),
    setupCallScheduled: z.boolean().optional(),
    dismissChecklist: z.boolean().optional(),
  })
  .strict();

/**
 * @name updateFtuxChecklistAction
 * @description [Business Logic]: Persists First-Time User Experience (FTUX) milestones
 * for newly registered organizations (accounting template configuration, setup call booking,
 * or checklist dismissal) scoped strictly to the authenticated administrator's tenant.
 */
export async function updateFtuxChecklistAction(
  rawInput: unknown
): Promise<{ success: boolean; error?: string; state?: FtuxState }> {
  try {
    const session = await requireAdminSession();
    const parsed = UpdateFtuxSchema.safeParse(rawInput);

    if (!parsed.success) {
      return { success: false, error: 'Parámetros de configuración inicial inválidos.' };
    }

    const { data: company, error: fetchErr } = await supabaseServer
      .from('empresas')
      .select('ftux_state')
      .eq('id', session.empresaId)
      .single();

    if (fetchErr || !company) {
      return { success: false, error: 'No se encontró la organización.' };
    }

    const current = (company.ftux_state as FtuxState | null) ?? {
      accounting_template_selected: null,
      setup_call_scheduled: false,
      first_employee_invited: false,
      checklist_dismissed: false,
    };

    const nextState: FtuxState = {
      accounting_template_selected:
        parsed.data.accountingTemplate ?? current.accounting_template_selected,
      setup_call_scheduled:
        parsed.data.setupCallScheduled ?? current.setup_call_scheduled,
      first_employee_invited: current.first_employee_invited,
      checklist_dismissed:
        parsed.data.dismissChecklist ?? current.checklist_dismissed,
    };

    // Apply default currency aligned with chosen accounting template
    const templateCurrencyMap: Record<string, string> = {
      VEN_SENIAT: 'VES',
      MEX_SAT: 'MXN',
      COL_DIAN: 'COP',
      INTL_IFRS: 'USD',
    };

    const updatePayload: Record<string, unknown> = { ftux_state: nextState };
    if (parsed.data.accountingTemplate) {
      updatePayload.moneda = templateCurrencyMap[parsed.data.accountingTemplate] || 'USD';
    }

    await supabaseServer
      .from('empresas')
      .update(updatePayload)
      .eq('id', session.empresaId);

    revalidatePath('/dashboard');
    return { success: true, state: nextState };
  } catch {
    return { success: false, error: 'Error al actualizar el progreso de configuración.' };
  }
}