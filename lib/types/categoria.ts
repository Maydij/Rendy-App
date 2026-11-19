/**
 * @file categoria.ts
 * @description [Business Logic]: Multi-tenant expense category definitions and daily spending limits.
 * Defines the standard 8 official categories for Rendy, along with custom organizational categories.
 */

export interface CategoriaGasto {
  id: string;
  empresa_id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  icono: string;
  limite_diario_usd: number;
  es_sistema: boolean;
  activa: boolean;
  orden: number;
  creado_en: string;
}

export interface CategoriaGastoInput {
  nombre: string;
  descripcion?: string;
  icono?: string;
  limiteDiarioUsd?: number;
}

export interface CategoriaDailyLimitEvaluation {
  exceedsLimit: boolean;
  dailyLimitUsd: number;
  currentExpenseUsd: number;
  accumulatedTodayUsd: number;
  totalWithCurrentUsd: number;
  categoryCode: string;
  categoryName: string;
  warningMessage: string | null;
}

/**
 * 8 Official Default Categories for all Rendy organizations.
 */
export const DEFAULT_OFFICIAL_CATEGORIES: ReadonlyArray<Omit<CategoriaGasto, 'id' | 'empresa_id' | 'creado_en'>> = [
  {
    codigo: 'FOOD_BEVERAGE',
    nombre: 'Food/Beverage',
    descripcion: 'Comidas, restaurantes y bebidas',
    icono: '🍔',
    limite_diario_usd: 0,
    es_sistema: true,
    activa: true,
    orden: 1,
  },
  {
    codigo: 'PARKING_TOLLS_TAXI',
    nombre: 'Parking & Tolls/Taxi',
    descripcion: 'Estacionamientos, peajes, taxis y Uber',
    icono: '🚕',
    limite_diario_usd: 0,
    es_sistema: true,
    activa: true,
    orden: 2,
  },
  {
    codigo: 'HOTEL',
    nombre: 'Hotel',
    descripcion: 'Hoteles, posadas y alojamiento',
    icono: '🏨',
    limite_diario_usd: 0,
    es_sistema: true,
    activa: true,
    orden: 3,
  },
  {
    codigo: 'GAS_FUEL',
    nombre: 'Gas (Fuel)',
    descripcion: 'Combustible, gasolina y diésel',
    icono: '⛽',
    limite_diario_usd: 0,
    es_sistema: true,
    activa: true,
    orden: 4,
  },
  {
    codigo: 'AIRFARE_TRAIN',
    nombre: 'Airfare/train',
    descripcion: 'Boletos aéreos, trenes y pasajes',
    icono: '✈️',
    limite_diario_usd: 0,
    es_sistema: true,
    activa: true,
    orden: 5,
  },
  {
    codigo: 'CAR_RENTAL',
    nombre: 'Car Rental',
    descripcion: 'Alquiler de vehículos y transporte',
    icono: '🚗',
    limite_diario_usd: 0,
    es_sistema: true,
    activa: true,
    orden: 6,
  },
  {
    codigo: 'MATERIALES',
    nombre: 'Materiales',
    descripcion: 'Insumos, repuestos y materiales operativos',
    icono: '📦',
    limite_diario_usd: 0,
    es_sistema: true,
    activa: true,
    orden: 7,
  },
  {
    codigo: 'MISCELLANEOUS',
    nombre: 'Miscellaneous',
    descripcion: 'Gastos varios y misceláneos',
    icono: '📌',
    limite_diario_usd: 0,
    es_sistema: true,
    activa: true,
    orden: 99,
  },
];
