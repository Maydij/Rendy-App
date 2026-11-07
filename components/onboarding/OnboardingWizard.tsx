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
import { Step7Checkout } from './Step7Checkout';
import { OnboardingSuccessModal } from './OnboardingSuccessModal';
import { OnboardingFormData } from './types';
import { Icon } from '@/components/landing/primitives';

const INITIAL_FORM_DATA: OnboardingFormData = {
  companyLegalName: 'Acme Solutions C.A.',
  companyTaxId: 'J-50493821-0',
  companyCountry: 'VE',
  companyAddress: 'Av. Francisco de Miranda, Torre Cavendes, Piso 9',
  selectedIndustry: 'Tecnología & SaaS',
  selectedCompanySize: 'STARTER 11-30',
  adminFirstName: 'Carlos',
  adminLastName: 'Mendoza',
  adminUsername: 'cmendoza',
  adminEmail: 'carlos@acmesolutions.com',
  adminPhoneCountryCode: '+58',
  adminPhone: '412 8901234',
  adminPassword: 'Rendy#Fintech$2025!',
  selectedPlan: 'business',
  billingCycle: 'annual',
  cardholderName: 'Carlos Mendoza',
  cardNumber: '',
  cardExp: '',
  cardCvc: '',
  cardCountry: 'VE',
  cardPostal: '7550000',
  termsAccepted: false,
};

/**
 * @name OnboardingWizard
 * @description [Business Logic]: Primary orchestrator for the 7-step enterprise onboarding lifecycle.
 * Manages atomic state progression across Legal Identity, Industry classification, Team sizing,
 * Root Admin provisioning, Access Roles, Plan Subscription, and Zero-Dollar Trial Authorization.
 */
export function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<OnboardingFormData>(INITIAL_FORM_DATA);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState<boolean>(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);

  const updateField = <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleGoToStep = (step: number) => {
    if (step >= 1 && step <= 7) {
      setCurrentStep(step);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStageNavigation = (targetStage: 1 | 2) => {
    if (targetStage === 1) {
      handleGoToStep(1);
    } else {
      handleGoToStep(6);
    }
  };

  // Step 3 -> Workspace Modal -> Step 4
  const handleOpenWorkspaceModal = () => {
    setIsWorkspaceModalOpen(true);
  };

  const handleContinueFromWorkspaceModal = () => {
    setIsWorkspaceModalOpen(false);
    handleGoToStep(4);
  };

  // Step 5 -> Step 6 transition with brief feedback toast
  const handleFinishStageOne = () => {
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      handleGoToStep(6);
    }, 900);
  };

  // Step 7 Checkout Submit
  const handleCheckoutSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccessModalOpen(true);
    }, 1200);
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-surface-container-lowest text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container">
      {/* Sticky Global Onboarding Header */}
      <OnboardingHeader
        currentStep={currentStep}
        onNavigateStage={handleStageNavigation}
      />

      {/* Main Container */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 pt-8 pb-16 flex flex-col justify-start items-center">
        {/* Dynamic Multi-Segment Progress Tracker */}
        <OnboardingProgress
          currentStep={currentStep}
          onGoToStep={handleGoToStep}
          onOpenWorkspaceModal={currentStep >= 3 ? handleOpenWorkspaceModal : undefined}
        />

        {/* Central Step View Area */}
        <div className="w-full max-w-4xl mx-auto relative flex flex-col justify-center">
          {currentStep === 1 && (
            <div className="w-full max-w-2xl mx-auto animate-fade-in">
              <Step1CompanyInfo
                formData={formData}
                updateField={updateField}
                onNext={() => handleGoToStep(2)}
              />
            </div>
          )}

          {currentStep === 2 && (
            <div className="w-full max-w-2xl mx-auto animate-fade-in">
              <Step2Industry
                formData={formData}
                updateField={updateField}
                onNext={() => handleGoToStep(3)}
                onBack={() => handleGoToStep(1)}
              />
            </div>
          )}

          {currentStep === 3 && (
            <div className="w-full max-w-2xl mx-auto animate-fade-in">
              <Step3TeamSize
                formData={formData}
                updateField={updateField}
                onSubmitCreateWorkspace={handleOpenWorkspaceModal}
                onBack={() => handleGoToStep(2)}
              />
            </div>
          )}

          {currentStep === 4 && (
            <div className="w-full max-w-2xl mx-auto animate-fade-in">
              <Step4AdminProfile
                formData={formData}
                updateField={updateField}
                onNext={() => handleGoToStep(5)}
                onBack={() => handleGoToStep(3)}
              />
            </div>
          )}

          {currentStep === 5 && (
            <div className="w-full max-w-2xl mx-auto animate-fade-in">
              <Step5TeamStructure
                onNext={handleFinishStageOne}
                onBack={() => handleGoToStep(4)}
              />
            </div>
          )}

          {currentStep === 6 && (
            <div className="w-full animate-fade-in">
              <Step6PlanSelection
                formData={formData}
                updateField={updateField}
                onNext={() => handleGoToStep(7)}
                onBack={() => handleGoToStep(5)}
              />
            </div>
          )}

          {currentStep === 7 && (
            <div className="w-full animate-fade-in">
              <Step7Checkout
                formData={formData}
                updateField={updateField}
                onSubmitCheckout={handleCheckoutSubmit}
                onBack={() => handleGoToStep(6)}
                isSubmitting={isSubmitting}
              />
            </div>
          )}
        </div>
      </main>

      {/* Floating Transition Toast between Stage 1 & 2 */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-surface-container-high border border-primary-container/40 text-on-surface px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
            <Icon name="done_all" className="text-[18px]" />
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

