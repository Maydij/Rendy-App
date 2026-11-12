'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { OnboardingHeader } from './OnboardingHeader';
import { OnboardingProgress } from './OnboardingProgress';
import { Step1CompanyInfo } from './Step1CompanyInfo';
import { Step2Industry } from './Step2Industry';
import { Step3TeamSize } from './Step3TeamSize';
import { WorkspaceCreatedModal } from './WorkspaceCreatedModal';
import { Step4AdminProfile } from './Step4AdminProfile';
import { Step5TeamStructure } from './Step5TeamStructure';
import { Step6PlanSelection } from './Step6PlanSelection';
import { OnboardingSuccessModal } from './OnboardingSuccessModal';
import { OnboardingFormData } from './types';
import { Icon } from '@/components/landing/primitives';
import { cn } from '@/lib/utils';
import {
  persistWizardCompanyStepAction,
  persistWizardAdminStepAction,
  saveOnboardingStep3PlanAction,
} from '@/app/actions/onboarding.actions';
import { StripeTrialCheckout } from '@/components/billing/StripeTrialCheckout';
import { toCanonicalPlanId, toCanonicalBillingCycle } from '@/lib/pricing';
import { trackProductEvent } from '@/lib/analytics/tracking-plan';

const INITIAL_FORM_DATA: OnboardingFormData = {
  companyLegalName: '',
  companyTaxId: '',
  companyCountry: 'VE',
  companyAddress: '',
  selectedIndustry: '',
  selectedCompanySize: '',
  adminFirstName: '',
  adminLastName: '',
  adminUsername: '',
  adminEmail: '',
  adminPhoneCountryCode: '+58',
  adminPhone: '',
  adminPassword: '',
  selectedPlan: 'growth',
  billingCycle: 'annual',
  cardholderName: '',
  cardNumber: '',
  cardExp: '',
  cardCvc: '',
  cardCountry: 'VE',
  cardPostal: '',
  termsAccepted: false,
};

/**
 * @name OnboardingWizard
 * @description [Business Logic]: Primary orchestrator for the 7-step enterprise onboarding lifecycle.
 * Persists partial lead state step-by-step in PostgreSQL, enforces Argon2id credential hashing,
 * recommends optimal subscription tiers by headcount, and delegates card capture to Stripe's
 * PCI-DSS Level 1 PaymentElement ($0.00 due today, 7-day free trial).
 */
export function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [displayStep, setDisplayStep] = useState<number>(1);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [transitionDirection, setTransitionDirection] = useState<'forward' | 'backward'>('forward');
  const [formData, setFormData] = useState<OnboardingFormData>(INITIAL_FORM_DATA);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [recommendedPlanId, setRecommendedPlanId] = useState<string>('GROWTH');
  const [stepError, setStepError] = useState<string | null>(null);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState<boolean>(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [isPersisting, setIsPersisting] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);

  const updateField = <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (stepError) setStepError(null);
  };

  const handleGoToStep = (step: number) => {
    if (step === displayStep || step < 1 || step > 7 || isExiting) return;

    const nextDirection = step > displayStep ? 'forward' : 'backward';
    setTransitionDirection(nextDirection);
    setIsExiting(true);
    setCurrentStep(step);
    setStepError(null);

    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
      setDisplayStep(step);
      setIsExiting(false);
    }, 180);
  };

  const handleStageNavigation = (targetStage: 1 | 2) => {
    if (targetStage === 1) {
      handleGoToStep(1);
    } else if (leadId) {
      handleGoToStep(6);
    }
  };

  // Step 1 -> Step 2 (Persist initial company lead with encrypted RIF)
  const handleStep1Next = async () => {
    setIsPersisting(true);
    setStepError(null);

    const res = await persistWizardCompanyStepAction({
      leadId: leadId ?? undefined,
      companyLegalName: formData.companyLegalName,
      companyTaxId: formData.companyTaxId,
      selectedIndustry: formData.selectedIndustry || undefined,
      selectedCompanySize: formData.selectedCompanySize || undefined,
    });

    setIsPersisting(false);

    if (!res.success || !res.data) {
      setStepError(res.error || 'Verifica los datos legales de tu empresa.');
      return;
    }

    setLeadId(res.data.leadId);
    setRecommendedPlanId(res.data.recommendation.recommendedPlanId);
    void trackProductEvent('onboarding_step_completed', {
      step_number: 1,
      step_name: 'ACCOUNT',
      duration_seconds: 15,
    });
    handleGoToStep(2);
  };

  // Step 2 -> Step 3 (Persist industry sector)
  const handleStep2Next = async () => {
    setIsPersisting(true);
    setStepError(null);

    const res = await persistWizardCompanyStepAction({
      leadId: leadId ?? undefined,
      companyLegalName: formData.companyLegalName,
      companyTaxId: formData.companyTaxId,
      selectedIndustry: formData.selectedIndustry,
      selectedCompanySize: formData.selectedCompanySize || undefined,
    });

    setIsPersisting(false);

    if (!res.success || !res.data) {
      setStepError(res.error || 'No se pudo guardar el sector de tu empresa.');
      return;
    }

    setLeadId(res.data.leadId);
    handleGoToStep(3);
  };

  // Step 3 -> Workspace Modal -> Step 4 (Persist team size & auto-recommend optimal plan)
  const handleOpenWorkspaceModal = async () => {
    setIsPersisting(true);
    setStepError(null);

    const res = await persistWizardCompanyStepAction({
      leadId: leadId ?? undefined,
      companyLegalName: formData.companyLegalName,
      companyTaxId: formData.companyTaxId,
      selectedIndustry: formData.selectedIndustry,
      selectedCompanySize: formData.selectedCompanySize,
    });

    setIsPersisting(false);

    if (!res.success || !res.data) {
      setStepError(res.error || 'No se pudo guardar el tamaño del equipo.');
      return;
    }

    setLeadId(res.data.leadId);
    setRecommendedPlanId(res.data.recommendation.recommendedPlanId);

    // Pre-select the intelligently recommended plan for the user's headcount
    const lowerRecommended = res.data.recommendation.recommendedPlanId.toLowerCase() as
      | 'starter'
      | 'growth'
      | 'enterprise';
    updateField('selectedPlan', lowerRecommended);

    void trackProductEvent('onboarding_step_completed', {
      step_number: 2,
      step_name: 'FISCAL_PROFILE',
      duration_seconds: 20,
    });

    setIsWorkspaceModalOpen(true);
  };

  const handleContinueFromWorkspaceModal = () => {
    setIsWorkspaceModalOpen(false);
    handleGoToStep(4);
  };

  // Step 4 -> Step 5 (Persist Admin email & Argon2id password hash)
  const handleStep4Next = async () => {
    if (!leadId) {
      setStepError('Sesión de registro no encontrada. Vuelve al Paso 1.');
      return;
    }

    setIsPersisting(true);
    setStepError(null);

    const res = await persistWizardAdminStepAction({
      leadId,
      adminFirstName: formData.adminFirstName,
      adminLastName: formData.adminLastName,
      adminEmail: formData.adminEmail,
      adminPassword: formData.adminPassword,
    });

    setIsPersisting(false);

    if (!res.success) {
      setStepError(res.error || 'Verifica los datos y contraseña del administrador.');
      return;
    }

    handleGoToStep(5);
  };

  // Step 5 -> Step 6 transition with brief feedback toast
  const handleFinishStageOne = () => {
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      handleGoToStep(6);
    }, 700);
  };

  // Step 6 -> Step 7 (Persist chosen plan & billing cycle before Stripe Trial Checkout)
  const handleStep6Next = async () => {
    if (!leadId) {
      setStepError('Sesión de registro no encontrada. Vuelve al Paso 1.');
      return;
    }

    setIsPersisting(true);
    setStepError(null);

    const canonicalPlan = toCanonicalPlanId(formData.selectedPlan);
    const canonicalCycle = toCanonicalBillingCycle(formData.billingCycle);

    const res = await saveOnboardingStep3PlanAction({
      leadId,
      planId: canonicalPlan,
      billingCycle: canonicalCycle,
    });

    setIsPersisting(false);

    if (!res.success) {
      setStepError(res.error || 'No se pudo guardar el plan seleccionado.');
      return;
    }

    void trackProductEvent('plan_recommendation_interacted', {
      recommended_plan_id: recommendedPlanId,
      selected_plan_id: canonicalPlan,
      billing_cycle: canonicalCycle,
      employee_bracket: formData.selectedCompanySize || '1-5',
    });

    handleGoToStep(7);
  };

  const stepAnimationClass = cn(
    'w-full will-change-transform',
    isExiting
      ? transitionDirection === 'forward'
        ? 'animate-step-exit-forward'
        : 'animate-step-exit-backward'
      : transitionDirection === 'forward'
      ? 'animate-step-enter-forward'
      : 'animate-step-enter-backward',
  );

  return (
    <div className="min-h-screen w-full flex flex-col bg-surface-container-lowest text-on-surface antialiased selection:bg-primary-container selection:text-black">
      {/* Sticky Global Onboarding Header */}
      <OnboardingHeader
        currentStep={currentStep}
        onNavigateStage={handleStageNavigation}
      />

      {/* Main Container */}
      <main className="relative z-10 flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-6 pt-6 pb-16 flex flex-col justify-start items-center">
        {/* Dynamic Multi-Segment Progress Tracker */}
        <OnboardingProgress
          currentStep={currentStep}
          onGoToStep={handleGoToStep}
        />

        {/* Global Step Validation / Persistence Error Banner */}
        {stepError && (
          <div
            role="alert"
            className="w-full max-w-2xl mx-auto mb-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-300 flex items-center gap-2.5"
          >
            <Icon name="error" className="text-red-400 text-[18px] shrink-0" />
            <span>{stepError}</span>
          </div>
        )}

        {/* Central Step View Area */}
        <div
          className={cn(
            'w-full mx-auto relative flex flex-col justify-center transition-all duration-300',
            displayStep === 6 ? 'max-w-[1360px]' : displayStep === 7 ? 'max-w-3xl' : 'max-w-4xl',
          )}
        >
          <div key={displayStep} className={stepAnimationClass}>
            {displayStep === 1 && (
              <div className="w-full max-w-2xl mx-auto">
                <Step1CompanyInfo
                  formData={formData}
                  updateField={updateField}
                  onNext={handleStep1Next}
                />
              </div>
            )}

            {displayStep === 2 && (
              <div className="w-full max-w-2xl mx-auto">
                <Step2Industry
                  formData={formData}
                  updateField={updateField}
                  onNext={handleStep2Next}
                  onBack={() => handleGoToStep(1)}
                />
              </div>
            )}

            {displayStep === 3 && (
              <div className="w-full max-w-2xl mx-auto">
                <Step3TeamSize
                  formData={formData}
                  updateField={updateField}
                  onSubmitCreateWorkspace={handleOpenWorkspaceModal}
                  onBack={() => handleGoToStep(2)}
                />
              </div>
            )}

            {displayStep === 4 && (
              <div className="w-full max-w-2xl mx-auto">
                <Step4AdminProfile
                  formData={formData}
                  updateField={updateField}
                  onNext={handleStep4Next}
                  onBack={() => handleGoToStep(3)}
                />
              </div>
            )}

            {displayStep === 5 && (
              <div className="w-full max-w-2xl mx-auto">
                <Step5TeamStructure
                  onNext={handleFinishStageOne}
                  onBack={() => handleGoToStep(4)}
                />
              </div>
            )}

            {displayStep === 6 && (
              <div className="w-full">
                <div className="mb-4 flex items-center justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-300">
                    Plan recomendado para tu equipo ({formData.selectedCompanySize || '1-5'}):{' '}
                    <strong>{recommendedPlanId}</strong> • Incluye 7 días gratis ($0.00 hoy)
                  </span>
                </div>
                <Step6PlanSelection
                  formData={formData}
                  updateField={updateField}
                  onNext={handleStep6Next}
                  onBack={() => handleGoToStep(5)}
                />
              </div>
            )}

            {displayStep === 7 && leadId && (
              <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Activa tu Prueba Gratuita de 7 Días
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Organización: <strong className="text-white">{formData.companyLegalName}</strong> • Plan:{' '}
                      <strong className="text-emerald-400 uppercase">{formData.selectedPlan}</strong> (
                      {formData.billingCycle === 'annual' ? 'Facturación Anual' : 'Facturación Mensual'})
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleGoToStep(6)}
                    className="text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                  >
                    ← Cambiar plan
                  </button>
                </div>

                <StripeTrialCheckout
                  leadId={leadId}
                  planId={toCanonicalPlanId(formData.selectedPlan)}
                  billingCycle={toCanonicalBillingCycle(formData.billingCycle)}
                  onTrialActivated={() => {
                    setIsSuccessModalOpen(true);
                    setTimeout(() => {
                      window.location.assign('/dashboard');
                    }, 1600);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Subtle Persistence Indicator */}
      {isPersisting && (
        <div className="fixed bottom-6 left-6 z-50 rounded-xl border border-slate-700 bg-slate-900/95 px-4 py-2.5 text-xs font-medium text-slate-200 shadow-xl">
          Guardando progreso cifrado...
        </div>
      )}

      {/* Floating Transition Toast between Stage 1 & 2 */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-surface-container-high border border-primary-container/40 text-on-surface px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-8 h-8 rounded-full bg-primary-container text-black flex items-center justify-center font-bold">
            <Icon name="done_all" className="text-[18px] text-black font-bold" />
          </div>
          <div className="flex flex-col">
            <span className="font-label-md text-label-md font-bold text-on-surface">
              Etapa 1 Completada con Éxito
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              Iniciando Selección y Contratación del Plan...
            </span>
          </div>
        </div>
      )}

      {/* Modals */}
      <WorkspaceCreatedModal
        isOpen={isWorkspaceModalOpen}
        formData={formData}
        onContinue={handleContinueFromWorkspaceModal}
      />

      <OnboardingSuccessModal
        isOpen={isSuccessModalOpen}
        formData={formData}
      />

      {/* Corporate Compliance Footer */}
      <footer className="relative z-10 w-full py-6 border-t border-surface-container-high/40 bg-surface-container-lowest/60">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center font-label-sm text-label-sm text-on-surface-variant/70">
          <div>© {new Date().getFullYear()} Rendy Financial Technologies Inc. Todos los derechos reservados.</div>
          <div className="flex items-center gap-6">
            <Link href="#" className="hover:text-on-surface transition-colors">
              Privacidad
            </Link>
            <Link href="#" className="hover:text-on-surface transition-colors">
              Términos de Servicio
            </Link>
            <Link href="#" className="hover:text-on-surface transition-colors">
              Cumplimiento Normativo
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}