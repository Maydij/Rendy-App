/**
 * @name ReembolsosLoading
 * @description [UI Component]: Streaming skeleton fallback matching the Stitch dark Bento,
 * Analytics, Filter Bar, and Master-Detail layout while server data is fetched.
 */

import React from 'react';

export default function ReembolsosLoading() {
  return (
    <div className="w-full flex flex-col gap-6 pb-12 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-surface-container-high shrink-0" />
          <div className="flex flex-col gap-2">
            <div className="w-56 h-7 rounded-lg bg-surface-container-high" />
            <div className="w-80 max-w-full h-4 rounded bg-surface-container-low" />
          </div>
        </div>
        <div className="flex gap-2.5">
          <div className="w-40 h-10 rounded-xl bg-surface-container-high" />
        </div>
      </div>

      {/* 4 KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 rounded-2xl bg-surface-container-low p-5 flex flex-col justify-between"
          >
            <div className="w-2/3 h-3 rounded bg-surface-container-high" />
            <div className="w-1/2 h-7 rounded bg-surface-container-high" />
            <div className="w-full h-3 rounded bg-surface-container-highest/50" />
          </div>
        ))}
      </div>

      {/* 2-Column Analytics Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-56 rounded-2xl bg-surface-container-low p-5" />
        <div className="h-56 rounded-2xl bg-surface-container-low p-5" />
      </div>

      {/* Filters Skeleton */}
      <div className="h-28 rounded-2xl bg-surface-container-low p-4" />

      {/* Split-View Master-Detail Skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-7 flex flex-col gap-3">
          {[0, 1, 2, 3].map((row) => (
            <div
              key={row}
              className="h-28 rounded-2xl bg-surface-container-low p-4"
            />
          ))}
        </div>
        <div className="xl:col-span-5 h-[520px] rounded-2xl bg-surface-container-low p-5" />
      </div>
    </div>
  );
}
