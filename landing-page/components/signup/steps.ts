export type ChoiceStepKey = "country" | "gender" | "ageRange" | "driverType" | "fillFrequency";
export type TextStepKey = "zip" | "email";
export type StepKey = ChoiceStepKey | TextStepKey;

export const CHOICE_STEP_ORDER: ChoiceStepKey[] = [
  "country",
  "gender",
  "ageRange",
  "driverType",
  "fillFrequency",
];
export const TEXT_STEP_ORDER: TextStepKey[] = ["zip", "email"];
export const STEP_ORDER: StepKey[] = [...CHOICE_STEP_ORDER, ...TEXT_STEP_ORDER];

export const GENDER_VALUES = ["male", "female", "unspecified"] as const;
export const AGE_RANGE_VALUES = ["18-24", "25-34", "35-44", "45-54", "55-plus"] as const;
export const DRIVER_TYPE_VALUES = ["commuter", "rideshare-delivery", "parent", "other"] as const;
export const FILL_FREQUENCY_VALUES = ["1-2", "3-4", "5-8", "9-plus"] as const;
export const AU_STATE_VALUES = ["nsw", "qld", "wa"] as const;
