'use client';

import React, { useState, useTransition } from 'react';
import {
  UserPlus,
  X,
  ShieldCheck,
  QrCode,
  Copy,
  Check,
  MessageSquare,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  createEmployeeInvitationAction,
  type CreatedInvitationArtifact,
  type ExpenseCategoryPermissions,
} from '@/app/actions/invitations.actions';
import { useEscapeClose } from '@/lib/hooks/use-escape-close';

interface InviteEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_TOGGLE_ITEMS: Array<{
  key: keyof ExpenseCategoryPermissions;
  label: string;
  description: string;
}> = [
  {
    key: 'ALIMENTACION',
    label: 'Alimentación y Comidas',
    description: 'Consumos en restaurantes y comidas durante jornadas o viajes.',
  },
  {
    key: 'TRANSPORTE',
    label: 'Transporte y Combustible',
    description: 'Taxis, traslados, peajes, gasolina y boletos terrestres/aéreos.',
  },
  {
    key: 'HOSPEDAJE',
    label: 'Hospedaje y Hoteles',
    description: 'Estadías autorizadas en hoteles y alojamientos corporativos.',
  },
  {
    key: 'REPRESENTACION',
    label: 'Gastos de Representación',
    description: 'Atención a clientes, reuniones comerciales y eventos.',
  },
  {
    key: 'OTROS',
    label: 'Otros Gastos Operativos',
    description: 'Papelería, insumos menores y gastos varios aprobados.',
  },
];

/**
 * @name InviteEmployeeModal
 * @description [Business Logic]: Administrative modal for onboarding new company employees,
 * configuring granular expense/reimbursement category switches, and generating single-use
 * Magic Links and QR Codes for instant WhatsApp bot activation.
 */
export function InviteEmployeeModal({ isOpen, onClose }: InviteEmployeeModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nationalIdCedula, setNationalIdCedula] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [department, setDepartment] = useState('Operaciones');

  const [allowedCategories, setAllowedCategories] = useState<ExpenseCategoryPermissions>({
    ALIMENTACION: true,
    TRANSPORTE: true,
    HOSPEDAJE: false,
    REPRESENTACION: false,
    OTROS: true,
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdArtifact, setCreatedArtifact] = useState<CreatedInvitationArtifact | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleResetAndClose = () => {
    if (isPending) return;
    setFirstName('');
    setLastName('');
    setNationalIdCedula('');
    setEmail('');
    setWhatsappPhone('');
    setDepartment('Operaciones');
    setErrorMsg(null);
    setCreatedArtifact(null);
    setCopiedLink(false);
    onClose();
  };

  useEscapeClose(handleResetAndClose, isOpen);

  if (!isOpen) return null;

  const toggleCategory = (key: keyof ExpenseCategoryPermissions) => {
    setAllowedCategories((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      const response = await createEmployeeInvitationAction({
        firstName,
        lastName,
        nationalIdCedula,
        email,
        whatsappPhone,
        department,
        allowedCategories,
      });

      if (!response.success || !response.data) {
        setErrorMsg(response.error || 'No se pudo crear la invitación.');
        return;
      }

      setCreatedArtifact(response.data);
    });
  };

  const handleCopyLink = async () => {
    if (!createdArtifact) return;
    await navigator.clipboard.writeText(createdArtifact.magicLinkUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={handleResetAndClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {createdArtifact ? 'Invitación Creada y Cifrada' : 'Alta e Invitación de Empleado'}
              </h3>
              <p className="text-xs text-slate-400">
                Datos protegidos con cifrado AES-256-GCM • Enlace único válido por 72h
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetAndClose}
            disabled={isPending}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        {createdArtifact ? (
          <div className="p-6 space-y-6">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-200 space-y-1">
                <p className="font-bold text-sm text-white">
                  ¡Invitación lista para {createdArtifact.employeeFullName}!
                </p>
                <p>
                  {createdArtifact.whatsappDispatched
                    ? 'Se envió automáticamente un mensaje de invitación al WhatsApp del colaborador.'
                    : 'Comparte el enlace único o pídele al colaborador que escanee este código QR.'}
                </p>
              </div>
            </div>

            {/* QR Code & Magic Link Display */}
            <div className="flex flex-col sm:flex-row items-center gap-6 rounded-xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="bg-white p-3 rounded-xl shrink-0 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={createdArtifact.qrCodeDataUrl}
                  alt="Código QR de Activación"
                  className="w-40 h-40"
                />
              </div>

              <div className="flex-1 space-y-3 w-full">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                  <QrCode className="h-4 w-4" />
                  <span>Enlace Mágico de Activación (Uso Único)</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdArtifact.magicLinkUrl}
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-xs font-bold text-white transition cursor-pointer shrink-0"
                  >
                    {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedLink ? 'Copiado' : 'Copiar'}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Al abrir este enlace o escanear el QR, el colaborador confirmará su vinculación,
                  creará su contraseña y recibirá el acceso directo al bot de WhatsApp.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white cursor-pointer"
              >
                Listo, volver al panel
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Personal & Corporate Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ej. Carlos"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Apellido *
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ej. Mendoza"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cédula / DNI (Cifrado AES-256) *
                </label>
                <input
                  type="text"
                  required
                  value={nationalIdCedula}
                  onChange={(e) => setNationalIdCedula(e.target.value)}
                  placeholder="Ej. V-24567890"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Correo Corporativo / Personal *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="carlos@empresa.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Teléfono WhatsApp (con código país) *
                </label>
                <div className="relative">
                  <MessageSquare className="h-4 w-4 text-emerald-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    required
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    placeholder="+584121234567"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Departamento *
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                >
                  <option value="Operaciones">Operaciones y Logística</option>
                  <option value="Ventas">Ventas y Comercial</option>
                  <option value="Administración">Administración y Finanzas</option>
                  <option value="Tecnología">Tecnología e Ingeniería</option>
                  <option value="Gerencia">Dirección / Gerencia</option>
                </select>
              </div>
            </div>

            {/* Configurable Category Permission Switches */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Categorías de Gastos y Reembolsos Permitidas
                </h4>
                <p className="text-[11px] text-slate-400">
                  Activa o desactiva los rubros que este colaborador podrá reportar por WhatsApp.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {CATEGORY_TOGGLE_ITEMS.map((item) => {
                  const enabled = allowedCategories[item.key];
                  return (
                    <div
                      key={item.key}
                      onClick={() => toggleCategory(item.key)}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2.5 cursor-pointer hover:border-slate-700 transition"
                    >
                      <div>
                        <div className="text-xs font-semibold text-white">{item.label}</div>
                        <div className="text-[11px] text-slate-400">{item.description}</div>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCategory(item.key);
                        }}
                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer ${
                          enabled ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                            enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetAndClose}
                disabled={isPending}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 py-2.5 text-xs font-bold text-white shadow-lg cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generando Invitación Cifrada...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>Crear Invitación y Generar QR</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}