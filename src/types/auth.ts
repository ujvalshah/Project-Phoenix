
export type AuthProvider = "email" | "google" | "linkedin";

export interface LoginPayload {
  email: string;
  password?: string;
}

export interface SignupPayload {
  fullName: string;
  email: string;
  password: string;
}

export const ENABLED_SOCIAL_PROVIDERS: AuthProvider[] = ["google", "linkedin"];
