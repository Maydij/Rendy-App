/**
 * @name ReembolsosLoading
 * @description [UI Component]: Streaming skeleton fallback displayed while server data
 * for reimbursements, KPIs, and employee filters is being fetched.
 */

import React from 'react';

export default function ReembolsosLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Header Skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div
          style={{
            width: '240px',
            height: '28px',
            background: 'var(--bg-surface)',
            borderRadius: '6px',
            animation: 'pulse 1.5s infinite',
          }}
        />
        <div
          style={{
            width: '380px',
            height: '16px',
            background: 'var(--bg-surface)',
            borderRadius: '4px',
            animation: 'pulse 1.5s infinite',
          }}
        />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="kpi-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="kpi-card" style={{ minHeight: '110px' }}>
            <div
              style={{
                width: '60%',
                height: '14px',
                background: 'var(--bg-elevated)',
                borderRadius: '4px',
                marginBottom: '12px',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <div
              style={{
                width: '80%',
                height: '24px',
                background: 'var(--bg-elevated)',
                borderRadius: '6px',
                marginBottom: '8px',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <div
              style={{
                width: '40%',
                height: '12px',
                background: 'var(--bg-elevated)',
                borderRadius: '4px',
                animation: 'pulse 1.5s infinite',
              }}
            />
          </div>
        ))}
      </div>

      {/* Filters Skeleton */}
      <div
        style={{
          height: '100px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--bg-border)',
          borderRadius: '14px',
          animation: 'pulse 1.5s infinite',
        }}
      />

      {/* Table Card Skeleton */}
      <div
        className="card"
        style={{
          minHeight: '350px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div
            key={row}
            style={{
              height: '42px',
              background: 'var(--bg-elevated)',
              borderRadius: '8px',
              animation: 'pulse 1.5s infinite',
            }}
          />
        ))}
      </div>
    </div>
  );
}

