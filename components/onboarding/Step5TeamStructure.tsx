'use client';

import React from 'react';
import { Icon } from '@/components/landing/primitives';

interface Step5Props {
  onNext: () => void;
  onBack: () => void;
}

/**
 * @name Step5TeamStructure
 * @description [Business Logic]: Details enterprise permission governance, confirming root
 * administrative custody to the organization creator while setting employee self-service scopes.
 */
export function Step5TeamStructure({ onNext, onBack }: Step5Props) {
  return (
    <section className="step-pane w-full transition-all duration-300">
      <div className="bg-surface-container-low rounded-2xl p-6 sm:p-8 md:p-10 shadow-2xl border border-surface-container-high/40 flex flex-col gap-6 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between animate-enter-up">
          <div className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-primary font-semibold">
              Paso 5 • Arquitectura de Acceso
            </span>
            <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
              Tu equipo, organizado desde el primer día
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Conoce cómo se estructuran las atribuciones en Rendy. Podrás invitar y definir sub-administradores más adelante.
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary-container shadow-inner flex-shrink-0">
            <Icon name="admin_panel_settings" className="text-[28px]" />
          </div>
        </div>

        {/* Creator Role Confirmation Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/40 flex items-start gap-4 shadow-md animate-enter-up [animation-delay:60ms]">
          <div className="w-11 h-11 rounded-xl bg-primary-container/20 text-primary-container flex items-center justify-center flex-shrink-0">
            <Icon name="verified" className="text-[26px]" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-headline-sm text-[16px] font-bold text-primary">
                ¡Ya tienes tu rol definido!
              </span>
              <span className="px-2 py-0.5 rounded-full bg-primary-container text-black text-[11px] font-bold uppercase tracking-wider">
                Creador
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface">
              Como creador de esta organización en Rendy, eres su{' '}
              <strong className="text-on-surface font-semibold">Administrador Principal</strong> con custodia legal,
              aprobación de límites y facturación.
            </p>
          </div>
        </div>

        {/* Two Comparison Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Administrador (Root Authority) */}
          <div className="p-6 rounded-2xl bg-surface-container-lowest border border-primary-container/40 flex flex-col justify-between relative shadow-lg animate-card-enter [animation-delay:110ms]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-primary-container shadow-[0_0_10px_#00e599]" />
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Administrador
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-primary-container/20 text-primary-container font-label-sm text-label-sm font-bold tracking-wider uppercase">
                  Tu Rol
                </span>
              </div>
              <p className="font-label-sm text-label-sm text-on-surface-variant mb-4">
                Asignado automáticamente al creador de la entidad.
              </p>
              <ul className="flex flex-col gap-2.5 text-on-surface font-label-md text-label-md">
                <li className="flex items-center gap-2">
                  <Icon name="check_circle" className="text-primary-container text-[18px]" />
                  <span>Emisión y bloqueo de tarjetas globales</span>
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="check_circle" className="text-primary-container text-[18px]" />
                  <span>Aprobación de fondos y pagos a proveedores</span>
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="check_circle" className="text-primary-container text-[18px]" />
                  <span>Configuración de reglas contables y ERP</span>
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="check_circle" className="text-primary-container text-[18px]" />
                  <span>Gestión de altas/bajas de colaboradores</span>
                </li>
              </ul>
            </div>

            <div className="mt-5 pt-3 bg-surface-container/40 -mx-6 -mb-6 px-6 pb-3 rounded-b-2xl flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm border-t border-surface-container-high/30">
              <span>Control Absoluto</span>
              <span className="text-primary font-mono font-semibold">Tier Admin 01</span>
            </div>
          </div>

          {/* Card 2: Colaborador */}
          <div className="p-6 rounded-2xl bg-surface-container-lowest/80 border border-surface-container-high/40 flex flex-col justify-between relative shadow-sm animate-card-enter [animation-delay:170ms]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-surface-container-high" />
                  <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Colaborador
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm font-semibold tracking-wider uppercase">
                  Invitados
                </span>
              </div>
              <p className="font-label-sm text-label-sm text-on-surface-variant mb-4">
                Diseñado para directores, ejecutivos y personal operativo.
              </p>
              <ul className="flex flex-col gap-2.5 text-on-surface-variant font-label-md text-label-md">
                <li className="flex items-center gap-2">
                  <Icon name="check" className="text-secondary text-[18px]" />
                  <span>Tarjeta virtual propia con límite asignado</span>
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="check" className="text-secondary text-[18px]" />
                  <span>Subida de facturas con foto o WhatsApp</span>
                </li>
                <li className="flex items-center gap-2">
                  <Icon name="check" className="text-secondary text-[18px]" />
                  <span>Rendición de cuentas y reembolsos</span>
                </li>
                <li className="flex items-center gap-2 text-on-surface-variant/50">
                  <Icon name="block" className="text-[18px]" />
                  <span>Sin acceso a fondos globales ni nómina</span>
                </li>
              </ul>
            </div>

            <div className="mt-5 pt-3 bg-surface-container/20 -mx-6 -mb-6 px-6 pb-3 rounded-b-2xl flex items-center justify-between text-on-surface-variant/70 font-label-sm text-label-sm border-t border-surface-container-high/30">
              <span>Operativa Diaria</span>
              <span className="font-mono">Invitación post-onboarding</span>
            </div>
          </div>
        </div>

        {/* Completion Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-surface-container-high/30 animate-enter-up [animation-delay:230ms]">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-full text-on-surface-variant hover:text-on-surface font-label-md text-label-md flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Icon name="arrow_back" className="text-[18px]" />
            <span>Volver a Perfil</span>
          </button>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button
              type="button"
              onClick={onNext}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-primary-container text-black font-headline-sm text-[16px] font-bold shadow-[0_0_32px_rgba(0,229,153,0.35)] hover:shadow-[0_0_42px_rgba(0,229,153,0.55)] hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Finalizar Etapa 1 e Ir al Plan</span>
              <Icon name="arrow_forward" className="text-[20px] text-black font-bold" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

