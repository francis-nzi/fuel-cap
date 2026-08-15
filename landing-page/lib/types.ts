export type UtmParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

export type SignupAnswers = {
  country?: string;
  state?: string;
  gender?: string;
  ageRange?: string;
  driverType?: string;
  fillFrequency?: string;
  zip?: string;
  email?: string;
};

export const FUNNEL_STEPS = [
  "started",
  "country",
  "gender",
  "ageRange",
  "driverType",
  "fillFrequency",
  "zip",
  "email",
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export type Submission = {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  completed: boolean;
  furthestStep: FunnelStep;
  /** Market/locale of the landing page the visitor arrived on (may differ from answers.country if they switched). */
  landingMarket?: string;
  answers: SignupAnswers;
  utm: UtmParams;
  referrer?: string;
  userAgent?: string;
};

export type PageView = {
  id: string;
  timestamp: string;
  utm: UtmParams;
  referrer?: string;
  userAgent?: string;
  path: string;
  market?: string;
};
