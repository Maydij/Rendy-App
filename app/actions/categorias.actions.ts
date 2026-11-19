'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase-server';
import { requireAdminSession } from '@/lib/auth/session-context';
import {
  type CategoriaGasto,
  type CategoriaGastoInput,
  DEFAULT_OFFICIAL_CATEGORIES,
} from '@/lib/types/categoria';

/* ─────────────────────────────────────────────────────────────
 * Zod Schemas (Strict Input Validation)
 * ───────────────────────────────────────────────────────────── */

const createCategorySchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, 'El nombre de la categoría es obligatorio.')
      .max(60, 'El nombre no puede exceder 60 caracteres.'),
    descripcion: z.string().trim().max(100).optional(),
    icono: z.string().trim().max(16).optional(),
    limiteDiarioUsd: z
      .number()
      .min(0, 'El límite diario debe ser mayor o igual a 0.')
      .optional()
      .default(0),
  })
  .strict();

const updateDailyLimitSchema = z
  .object({
    categoriaId: z.string().uuid('ID de categoría inválido.'),
    limiteDiarioUsd: z.number().min(0, 'El límite diario debe ser mayor o igual a 0.'),
  })
  .strict();

const toggleCategorySchema = z
  .object({
    categoriaId: z.string().uuid('ID de categoría inválido.'),
    activa: z.boolean(),
  })
  .strict();

const deleteCategorySchema = z
  .object({
    categoriaId: z.string().uuid('ID de categoría inválido.'),
  })
  .strict();

/* ─────────────────────────────────────────────────────────────
 * Helper: Code Normalization
 * ───────────────────────────────────────────────────────────── */

/**
 * @name normalizarCodigoCategoria
 * @description [Business Logic]: Converts a human-readable category name into a unique,
 * alphanumeric snake_case uppercase identifier (e.g. "Food/Beverage" -> "FOOD_BEVERAGE").
 */
export async function normalizarCodigoCategoria(nombre: string): Promise<string> {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50);
}

/* ─────────────────────────────────────────────────────────────
 * Server Actions
 * ───────────────────────────────────────────────────────────── */

/**
 * @name obtenerCategoriasEmpresa
 * @description [Business Logic]: Retrieves all expense categories for the active company,
 * ordered by system order and display name. If the company does not have categories seeded yet,
 * it automatically provisions the 8 standard default categories.
 */
export async function obtenerCategoriasEmpresa(empresaId: string): Promise<CategoriaGasto[]> {
  try {
    const { data: categorias, error } = await supabaseServer
      .from('categorias_gastos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true });

    if (error) {
      console.warn('⚠️ [obtenerCategoriasEmpresa] Error querying categorias_gastos:', error.message);
      // Fallback: return default in-memory categories if table not yet created
      return DEFAULT_OFFICIAL_CATEGORIES.map((def, idx) => ({
        id: `mock-${idx}`,
        empresa_id: empresaId,
        ...def,
        creado_en: new Date().toISOString(),
      }));
    }

    // If company has no categories in database, seed the 8 defaults on the fly
    if (!categorias || categorias.length === 0) {
      const seedRows = DEFAULT_OFFICIAL_CATEGORIES.map((cat) => ({
        empresa_id: empresaId,
        ...cat,
      }));

      const { data: seeded, error: seedError } = await supabaseServer
        .from('categorias_gastos')
        .insert(seedRows)
        .select();

      if (!seedError && seeded && seeded.length > 0) {
        return seeded as CategoriaGasto[];
      }
    }

    return (categorias || []) as CategoriaGasto[];
  } catch (err) {
    console.error('❌ [obtenerCategoriasEmpresa] Unexpected error:', err);
    return DEFAULT_OFFICIAL_CATEGORIES.map((def, idx) => ({
      id: `fallback-${idx}`,
      empresa_id: empresaId,
      ...def,
      creado_en: new Date().toISOString(),
    }));
  }
}

/**
 * @name crearCategoriaPersonalizada
 * @description [Business Logic]: Registers a new operational expense category for the company.
 * Generates an uppercase snake_case code and assigns a daily limit if provided.
 */
export async function crearCategoriaPersonalizada(input: CategoriaGastoInput) {
  const session = await requireAdminSession();
  const parsed = createCategorySchema.parse(input);

  const codigo = await normalizarCodigoCategoria(parsed.nombre);
  const limiteSanitizado = Math.max(0, Number(parsed.limiteDiarioUsd) || 0);

  const { data, error } = await supabaseServer
    .from('categorias_gastos')
    .insert({
      empresa_id: session.empresaId,
      codigo,
      nombre: parsed.nombre,
      descripcion: parsed.descripcion || `Gastos de ${parsed.nombre}`,
      icono: parsed.icono || '🏷️',
      limite_diario_usd: limiteSanitizado,
      es_sistema: false,
      activa: true,
      orden: 50,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe una categoría con un nombre o código similar en tu empresa.' };
    }
    return { error: `Error al crear categoría: ${error.message}` };
  }

  revalidatePath('/dashboard/configuracion');
  revalidatePath('/dashboard/organizacion');
  return { error: null, data: data as CategoriaGasto };
}

/**
 * @name actualizarLimiteDiarioCategoria
 * @description [Business Logic]: Modifies the daily USD spending limit for a specific category.
 * Setting the value to 0 removes the limit (unrestricted spending without alerts).
 */
export async function actualizarLimiteDiarioCategoria(input: {
  categoriaId: string;
  limiteDiarioUsd: number;
}) {
  const session = await requireAdminSession();
  const parsed = updateDailyLimitSchema.parse(input);

  const { error } = await supabaseServer
    .from('categorias_gastos')
    .update({ limite_diario_usd: parsed.limiteDiarioUsd })
    .eq('id', parsed.categoriaId)
    .eq('empresa_id', session.empresaId);

  if (error) {
    return { error: `Error al actualizar límite diario: ${error.message}` };
  }

  revalidatePath('/dashboard/configuracion');
  revalidatePath('/dashboard/organizacion');
  return { error: null, limite_diario_usd: parsed.limiteDiarioUsd };
}

/**
 * @name toggleCategoriaActiva
 * @description [Business Logic]: Enables or disables an expense category for the company.
 * Inactive categories do not appear in WhatsApp selection menus.
 */
export async function toggleCategoriaActiva(input: {
  categoriaId: string;
  activa: boolean;
}) {
  const session = await requireAdminSession();
  const parsed = toggleCategorySchema.parse(input);

  const { error } = await supabaseServer
    .from('categorias_gastos')
    .update({ activa: parsed.activa })
    .eq('id', parsed.categoriaId)
    .eq('empresa_id', session.empresaId);

  if (error) {
    return { error: `Error al actualizar estado de la categoría: ${error.message}` };
  }

  revalidatePath('/dashboard/configuracion');
  revalidatePath('/dashboard/organizacion');
  return { error: null };
}

/**
 * @name eliminarCategoriaPersonalizada
 * @description [Business Logic]: Permanently deletes a custom category created by the organization.
 * System default categories cannot be deleted.
 */
export async function eliminarCategoriaPersonalizada(input: { categoriaId: string }) {
  const session = await requireAdminSession();
  const parsed = deleteCategorySchema.parse(input);

  const { error } = await supabaseServer
    .from('categorias_gastos')
    .delete()
    .eq('id', parsed.categoriaId)
    .eq('empresa_id', session.empresaId)
    .eq('es_sistema', false);

  if (error) {
    return { error: `Error al eliminar la categoría: ${error.message}` };
  }

  revalidatePath('/dashboard/configuracion');
  revalidatePath('/dashboard/organizacion');
  return { error: null };
}
