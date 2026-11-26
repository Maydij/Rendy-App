'use client';

/**
 * @file CategoriasTabSection.tsx
 * @description [UI Organism]: Manages custom and default official expense categories with
 * inline daily USD limits, active switches, and custom category creation modal in Stitch styling.
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { CategoriaGasto } from '@/lib/types/categoria';

interface CategoriasTabSectionProps {
  categorias: CategoriaGasto[];
  isPending: boolean;
  onUpdateDailyLimit: (catId: string, val: number) => void;
  onToggleCategoria: (catId: string, currentActiva: boolean) => void;
  onDeleteCategoria: (catId: string, nombre: string) => void;
  onOpenNewModal: () => void;
}

function CategoryLimitInput({
  initialLimit,
  onSave,
  disabled,
}: {
  initialLimit: number;
  onSave: (val: number) => void;
  disabled?: boolean;
}) {
  const [val, setVal] = useState(initialLimit.toString());
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setVal(initialLimit.toString());
  }, [initialLimit]);

  const commitChange = () => {
    setIsEditing(false);
    const parsed = Math.max(0, parseFloat(val) || 0);
    if (parsed !== initialLimit) {
      onSave(parsed);
    }
  };

  const num = parseFloat(val) || 0;

  return (
    <div className="flex flex-col items-start min-w-[140px]">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-on-surface-variant">$</span>
        <input
          type="number"
          step="any"
          min="0"
          value={val}
          disabled={disabled}
          onFocus={() => setIsEditing(true)}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commitChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          className={`w-24 px-2.5 py-1.5 text-xs text-right font-bold font-mono rounded-lg bg-surface-container-lowest text-on-surface transition-all focus:outline-none ${
            isEditing ? 'ring-1 ring-primary' : ''
          }`}
        />
        <span className="text-[11px] text-on-surface-variant">USD/día</span>
      </div>
      <span
        className={`text-[10px] font-semibold mt-1 ${
          num > 0 ? 'text-primary' : 'text-on-surface-variant/70'
        }`}
      >
        {num > 0 ? `Tope: $${num.toFixed(2)} / día` : 'Sin límite diario'}
      </span>
    </div>
  );
}

function CategoryRowItem({
  categoria,
  onUpdateLimit,
  onToggleActive,
  onDelete,
  disabled,
}: {
  categoria: CategoriaGasto;
  onUpdateLimit: (val: number) => void;
  onToggleActive: (activa: boolean) => void;
  onDelete?: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-surface-container gap-4 transition-all ${
        categoria.activa ? 'opacity-100' : 'opacity-60'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-xl leading-none shrink-0">{categoria.icono || '🏷️'}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-on-surface truncate">
              {categoria.nombre}
            </span>
            {categoria.es_sistema ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface-container-highest text-on-surface-variant">
                Oficial Rendy
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary/15 text-primary">
                Personalizada
              </span>
            )}
          </div>
          {categoria.descripcion && (
            <div className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-1">
              {categoria.descripcion}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-5 flex-wrap pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-container-highest/20">
        <CategoryLimitInput
          initialLimit={categoria.limite_diario_usd}
          onSave={onUpdateLimit}
          disabled={disabled || !categoria.activa}
        />

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={categoria.activa}
              disabled={disabled}
              onChange={(e) => onToggleActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-surface-container-highest rounded-full peer peer-checked:bg-primary-container transition-colors relative">
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  categoria.activa ? 'left-[18px]' : 'left-0.5'
                }`}
              />
            </div>
            <span
              className={`text-xs font-semibold ${
                categoria.activa ? 'text-on-surface' : 'text-on-surface-variant'
              }`}
            >
              {categoria.activa ? 'Activa' : 'Pausada'}
            </span>
          </label>

          {!categoria.es_sistema && onDelete && (
            <button
              type="button"
              disabled={disabled}
              onClick={onDelete}
              className="p-2 rounded-lg bg-error-container/20 text-error hover:bg-error-container/35 transition-colors cursor-pointer"
              title="Eliminar categoría personalizada"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CategoriasTabSection({
  categorias,
  isPending,
  onUpdateDailyLimit,
  onToggleCategoria,
  onDeleteCategoria,
  onOpenNewModal,
}: CategoriasTabSectionProps) {
  const customCats = categorias.filter((c) => !c.es_sistema);
  const systemCats = categorias.filter((c) => c.es_sistema);

  return (
    <div className="rounded-2xl bg-surface-container-low p-5 sm:p-6 flex flex-col gap-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-container-highest/20 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-on-surface">
            Catálogo de Categorías y Límites Diarios
          </h2>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
            Configura las categorías de gastos y establece topes diarios en USD para alertas automáticas en WhatsApp.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewModal}
          className="px-4 py-2.5 rounded-full bg-primary-container hover:bg-primary-fixed text-on-primary-container text-xs font-bold shadow-[0_0_20px_rgba(0,229,153,0.25)] inline-flex items-center justify-center gap-1.5 self-start sm:self-auto shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Categoría</span>
        </button>
      </div>

      {/* Custom Categories */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-on-surface">Categorías Personalizadas</h3>
          <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary text-[11px] font-bold">
            {customCats.length}
          </span>
        </div>

        {customCats.length === 0 ? (
          <div className="p-6 rounded-xl bg-surface-container-lowest/60 border border-dashed border-outline-variant/40 text-center text-xs sm:text-sm text-on-surface-variant">
            No has creado categorías personalizadas aún. Haz clic en{' '}
            <strong className="text-on-surface">&quot;Nueva Categoría&quot;</strong> para añadir
            categorías específicas de tu operación.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {customCats.map((cat) => (
              <CategoryRowItem
                key={cat.id}
                categoria={cat}
                onUpdateLimit={(val) => onUpdateDailyLimit(cat.id, val)}
                onToggleActive={() => onToggleCategoria(cat.id, cat.activa)}
                onDelete={() => onDeleteCategoria(cat.id, cat.nombre)}
                disabled={isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* System Official Categories */}
      <div className="flex flex-col gap-3 pt-2 border-t border-surface-container-highest/20">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-on-surface">
            Categorías Oficiales por Defecto
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-bold">
            {systemCats.length}
          </span>
        </div>
        <p className="text-xs text-on-surface-variant">
          Categorías universales de Rendy. Puedes ajustar su límite diario o pausarlas si tu empresa no las requiere.
        </p>

        <div className="flex flex-col gap-2.5">
          {systemCats.map((cat) => (
            <CategoryRowItem
              key={cat.id}
              categoria={cat}
              onUpdateLimit={(val) => onUpdateDailyLimit(cat.id, val)}
              onToggleActive={() => onToggleCategoria(cat.id, cat.activa)}
              disabled={isPending}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ModalNuevaCategoria({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    nombre: string;
    descripcion: string;
    icono: string;
    limiteDiarioUsd: number;
  }) => void;
  isSubmitting: boolean;
}) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [icono, setIcono] = useState('🏷️');
  const [limiteDiario, setLimiteDiario] = useState('0');

  if (!isOpen) return null;

  const EMOJIS = [
    '🏷️',
    '📦',
    '🛠️',
    '💻',
    '🩺',
    '🎓',
    '⚖️',
    '📑',
    '🚚',
    '💡',
    '📱',
    '🎟️',
    '🛒',
    '☕',
    '🏢',
  ];

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface-container rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-surface-container-highest/20 flex items-center justify-between bg-surface-container-low">
          <span className="text-sm sm:text-base font-bold text-on-surface">
            Nueva Categoría Personalizada
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              nombre,
              descripcion,
              icono,
              limiteDiarioUsd: parseFloat(limiteDiario) || 0,
            });
          }}
          className="p-5 flex flex-col gap-4"
        >
          <div>
            <label className="block text-xs font-semibold text-on-surface mb-2">
              Icono / Emoji
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setIcono(em)}
                  className={`text-lg px-2 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                    icono === em
                      ? 'border-primary bg-primary/15'
                      : 'border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-high'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Nombre de la Categoría *
            </label>
            <input
              type="text"
              required
              maxLength={30}
              placeholder="ej. Envíos y Courier, Licencias Software"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-container-lowest text-xs sm:text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="block text-[11px] text-on-surface-variant mt-1">
              Recomendado máx. 20 caracteres para visualización óptima en WhatsApp.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Descripción (Opcional)
            </label>
            <input
              type="text"
              maxLength={80}
              placeholder="ej. Paquetería local, despachos y encomiendas"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-container-lowest text-xs sm:text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Límite Diario en USD (Opcional)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-on-surface-variant">$</span>
              <input
                type="number"
                step="any"
                min="0"
                value={limiteDiario}
                onChange={(e) => setLimiteDiario(e.target.value)}
                className="w-32 px-3 py-2 rounded-xl bg-surface-container-lowest text-xs sm:text-sm font-bold font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-xs text-on-surface-variant">USD / día</span>
            </div>
            <span className="block text-[11px] text-on-surface-variant mt-1">
              Deja en 0 para permitir gastos sin tope diario.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-full bg-surface-container-high text-on-surface text-xs font-semibold hover:bg-surface-container-highest transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !nombre.trim()}
              className="px-5 py-2 rounded-full bg-primary-container hover:bg-primary text-on-primary-container text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Guardando...' : 'Crear Categoría'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
