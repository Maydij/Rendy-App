'use client';

/**
 * @name ProjectMonitoringPanel
 * @description [UI Component]: Analytical comparison chart per cost center/project showing
 * real approved travel allowance funds (`Otorgado`) vs. receipts justified via WhatsApp (`Rendido`).
 */

import React, { useState } from 'react';
import { BarChart3, CheckCircle2, FolderKanban, ChevronDown, ChevronUp } from 'lucide-react';
import {
  formatCompactCurrency,
  formatMoney,
  getCurrencyPrefix,
  type ProjectMonitoringSummary,
} from './types';

interface ProjectMonitoringPanelProps {
  projects: ProjectMonitoringSummary[];
  selectedProject: string;
  onSelectProject: (projectName: string) => void;
}

export function ProjectMonitoringPanel({
  projects,
  selectedProject,
  onSelectProject,
}: ProjectMonitoringPanelProps) {
  const [showAll, setShowAll] = useState(false);

  if (projects.length === 0) {
    return null;
  }

  const visibleProjects = showAll ? projects : projects.slice(0, 3);
  const maxAmount = Math.max(
    ...projects.map((p) => Math.max(p.otorgado, p.justificado)),
    1
  );

  return (
    <div className="w-full rounded-2xl bg-surface-container p-5 shadow-md border border-surface-container-high/60 flex flex-col gap-4 relative z-10">
      {/* Header & Legend */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-surface-container-high/60 pb-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center text-primary shadow-[0_0_12px_rgba(0,229,153,0.25)] shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-on-surface">
                Monitoreo de Fondos Otorgados vs. Justificados
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                En tiempo real
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant truncate">
              Comparativa por centro de costos y ejecución de comprobantes vía WhatsApp
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-secondary" />
            <span className="text-on-surface-variant">Otorgado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-primary" />
            <span className="text-on-surface-variant">100% Justificado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-tertiary-container" />
            <span className="text-on-surface-variant">En Rendición</span>
          </div>
        </div>
      </div>

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-1">
        {visibleProjects.map((project) => {
          const isComplete = project.pendiente <= 0 && project.otorgado > 0;
          const isActiveFilter = selectedProject === project.name;
          const prefix = getCurrencyPrefix(project.currency);

          // Scale bars nicely relative to the highest project volume (22% floor for visual legibility)
          const otorgadoBarPct = Math.max(
            18,
            Math.round((project.otorgado / maxAmount) * 100)
          );
          const justificadoBarPct =
            project.justificado > 0
              ? Math.max(12, Math.min(100, Math.round((project.justificado / maxAmount) * 100)))
              : 4;

          return (
            <button
              key={project.name}
              type="button"
              onClick={() =>
                onSelectProject(isActiveFilter ? 'all' : project.name)
              }
              className={`text-left flex flex-col justify-between p-4 rounded-xl bg-surface-container-lowest border transition-all cursor-pointer ${
                isActiveFilter
                  ? 'border-secondary/60 ring-1 ring-secondary/30'
                  : 'border-surface-container-high/50 hover:border-surface-container-highest'
              }`}
            >
              {/* Card Title + Status Pill */}
              <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderKanban
                    className={`w-4 h-4 shrink-0 ${
                      isComplete ? 'text-primary' : 'text-tertiary-container'
                    }`}
                  />
                  <span className="text-xs sm:text-sm font-bold text-on-surface tracking-tight truncate">
                    {project.name}
                  </span>
                </div>

                {isComplete ? (
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    100% Justificado
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-tertiary-container text-[10px] font-bold flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary-container animate-pulse" />
                    {prefix}{formatMoney(project.pendiente)} Pendiente
                  </span>
                )}
              </div>

              {/* Dual Bar Visualization */}
              <div className="flex items-end justify-center gap-8 h-28 pt-4 pb-2 px-4 bg-surface-container-low/60 rounded-xl mb-3 overflow-hidden">
                {/* Bar 1: Otorgado */}
                <div className="flex flex-col items-center justify-end h-full gap-1.5 w-14">
                  <span className="font-mono text-[10px] text-secondary font-semibold leading-none whitespace-nowrap">
                    {formatCompactCurrency(project.otorgado, project.currency)}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-secondary/30 border-t-2 border-secondary transition-all duration-500"
                    style={{ height: `${Math.round(otorgadoBarPct * 0.72)}%` }}
                  />
                </div>

                {/* Bar 2: Justificado */}
                <div className="flex flex-col items-center justify-end h-full gap-1.5 w-14">
                  <span
                    className={`font-mono text-[10px] font-bold leading-none whitespace-nowrap ${
                      isComplete ? 'text-primary' : 'text-tertiary-container'
                    }`}
                  >
                    {formatCompactCurrency(project.justificado, project.currency)}
                  </span>
                  <div
                    className={`w-full rounded-t-md transition-all duration-500 ${
                      isComplete
                        ? 'bg-primary shadow-[0_0_12px_rgba(0,229,153,0.4)]'
                        : 'bg-tertiary-container shadow-[0_0_12px_rgba(252,192,37,0.35)]'
                    }`}
                    style={{ height: `${Math.round(justificadoBarPct * 0.72)}%` }}
                  />
                </div>
              </div>

              {/* Card Bottom Metrics */}
              <div className="flex items-center justify-between gap-2 text-[11px] text-on-surface-variant pt-2.5 border-t border-surface-container-high/60">
                <span className="shrink-0">
                  Justificado:{' '}
                  <strong className="text-on-surface font-mono font-bold">
                    {project.pct}%
                  </strong>
                </span>
                <span
                  className={`font-mono font-semibold truncate ${
                    isComplete ? 'text-primary' : 'text-tertiary-container'
                  }`}
                >
                  {prefix}{formatMoney(project.justificado)} / {prefix}{formatMoney(project.otorgado)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Show More Projects Toggle if > 3 */}
      {projects.length > 3 && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container-high text-xs font-medium text-on-surface-variant hover:text-on-surface transition-colors"
          >
            {showAll ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Mostrar top 3 proyectos</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Ver todos los proyectos ({projects.length})</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
