export type Gasto = {
  id: string;
  empleado: string;
  categoria: string;
  comercio: string;
  monto: number;
  moneda: string;
  tasa_cambio?: number | null;
  monto_convertido?: number | null;
  moneda_viatico?: string | null;
  fecha_gasto: string;
  creado_en?: string;
  proyecto: string;
  metodo_pago: string;
  estado: string;
  url_comprobante: string | null;
  concepto: string | null;
  datos_ocr?: any;
};