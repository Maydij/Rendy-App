import React from 'react';
import type { Metadata } from 'next';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

export const metadata: Metadata = {
  title: 'Registro de Empresa • Rendy',
  description:
    'Crea la organización de tu empresa, configura el perfil de Administrador Principal y comienza tu prueba gratuita de 7 días.',
};

/**
 * @name RegisterPage
 * @description [Business Logic]: Multi-step enterprise registration gateway facilitating
 * business legal registration, role architecture setup, and zero-dollar trial plan activation.
 */
export default function RegisterPage() {
  return <OnboardingWizard />;
}

