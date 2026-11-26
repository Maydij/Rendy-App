/**
 * @file RolBadge.tsx
 * @description [UI Atom]: Role pill indicator distinguishing organization administrators
 * from standard collaborators in Stitch styling.
 */

import React from 'react';

export function RolBadge({ rol }: { rol: string }) {
  const isAdmin = rol === 'ADMIN';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
        isAdmin ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-primary' : 'bg-secondary'}`}
      />
      {isAdmin ? 'Admin' : 'Empleado'}
    </span>
  );
}
