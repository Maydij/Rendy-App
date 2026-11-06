import React from 'react';
import type { Metadata } from 'next';
import { AuthVisuals } from '@/components/auth/AuthVisuals';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Iniciar sesión • Rendy',
  description: 'Ingresa a tu cuenta para continuar gestionando tus finanzas corporativas.',
};

/**
 * @name LoginPage
 * @description [Business Logic]: Corporate authentication portal allowing enterprise employees,
 * finance managers, and administrators to securely access their accounts via SSO or direct credentials.
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-surface">
      {/* Left Column: Institutional Value Proposition & Live Financial Telemetry */}
      <AuthVisuals />

      {/* Right Column: Secure Authentication Form & Gateway Controls */}
      <LoginForm />
    </div>
  );
}

