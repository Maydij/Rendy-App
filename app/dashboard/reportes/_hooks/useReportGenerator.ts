'use client';

/**
 * @file useReportGenerator.ts
 * @description [Business Logic Hook]: Coordinates the client-side lifecycle for generating,
 * downloading, and re-exporting accounting reports in Excel (.xlsx) format.
 * Encapsulates filter mutation, asynchronous server action dispatch, Base64 decoding,
 * and programmatic browser file trigger.
 */

import { useState, useCallback } from 'react';
import {
  exportAccountingReportAction,
  type ExportReportResult,
} from '../actions';
import type { ReportFilters } from '@/lib/services/excelReportGenerator';

export interface UseReportGeneratorReturn {
  filters: ReportFilters;
  format: 'XLSX' | 'PDF';
  isGenerating: boolean;
  errorMessage: string | null;
  lastResult: ExportReportResult | null;
  setFormat: (fmt: 'XLSX' | 'PDF') => void;
  updateFilter: <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => void;
  resetFilters: () => void;
  handleExport: (customFilters?: ReportFilters) => Promise<ExportReportResult | null>;
  clearNotifications: () => void;
}

const DEFAULT_FILTERS: ReportFilters = {
  dateFrom: '',
  dateTo: '',
  currency: 'ALL',
  projectId: 'ALL',
  employeeId: 'ALL',
  expenseType: 'ALL',
};

/**
 * @name triggerBlobDownload
 * @description [Utility]: Converts base64 encoded binary data into an in-memory Blob
 * and triggers an instant native browser download.
 */
function triggerBlobDownload(base64: string, filename: string, mimeType: string): void {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, 250);
}

/**
 * @name useReportGenerator
 * @description [Custom Hook]: Manages filtering state, server action requests, and download automation.
 */
export function useReportGenerator(): UseReportGeneratorReturn {
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [format, setFormat] = useState<'XLSX' | 'PDF'>('XLSX');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ExportReportResult | null>(null);

  const updateFilter = useCallback(<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
    setErrorMessage(null);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setErrorMessage(null);
  }, []);

  const clearNotifications = useCallback(() => {
    setErrorMessage(null);
    setLastResult(null);
  }, []);

  const handleExport = useCallback(
    async (overrideFilters?: ReportFilters): Promise<ExportReportResult | null> => {
      setIsGenerating(true);
      setErrorMessage(null);

      try {
        const activeFilters = overrideFilters || filters;
        const result = await exportAccountingReportAction(activeFilters);

        if (!result.success || !result.base64 || !result.filename) {
          setErrorMessage(result.error || 'Ocurrió un error al generar el archivo del reporte.');
          setIsGenerating(false);
          return null;
        }

        // Trigger download
        triggerBlobDownload(
          result.base64,
          result.filename,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        setLastResult(result);
        setIsGenerating(false);
        return result;
      } catch (err) {
        console.error('❌ [useReportGenerator] Export failure:', err);
        setErrorMessage(
          err instanceof Error ? err.message : 'Error inesperado de comunicación con el servidor.'
        );
        setIsGenerating(false);
        return null;
      }
    },
    [filters]
  );

  return {
    filters,
    format,
    isGenerating,
    errorMessage,
    lastResult,
    setFormat,
    updateFilter,
    resetFilters,
    handleExport,
    clearNotifications,
  };
}

