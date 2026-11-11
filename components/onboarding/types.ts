export type PlanTier = 'starter' | 'growth' | 'enterprise';
export type BillingCycle = 'annual' | 'monthly';

export interface OnboardingFormData {
  // Step 1: Legal Identity
  companyLegalName: string;
  companyTaxId: string;
  companyCountry: string;
  companyAddress: string;

  // Step 2: Industry
  selectedIndustry: string;

  // Step 3: Company Size
  selectedCompanySize: string;

  // Step 4: Admin Profile
  adminFirstName: string;
  adminLastName: string;
  adminUsername: string;
  adminEmail: string;
  adminPhoneCountryCode: string;
  adminPhone: string;
  adminPassword: string;

  // Step 6: Plan Selection
  selectedPlan: PlanTier;
  billingCycle: BillingCycle;

  // Step 7: Payment & Checkout
  cardholderName: string;
  cardNumber: string;
  cardExp: string;
  cardCvc: string;
  cardCountry: string;
  cardPostal: string;
  termsAccepted: boolean;
}

export interface PlanDetails {
  id: PlanTier;
  name: string;
  badge: string;
  badgeType?: 'primary' | 'secondary' | 'neutral';
  monthlyPrice: number;
  annualPrice: number;
  annualTotal: number;
  description: string;
  featuresTitle: string;
  features: string[];
  recommended?: boolean;
  highlightLabel?: string;
  targetEmployees?: string;
}

