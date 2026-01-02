
export type AuthProvider = "email" | "google" | "linkedin";

export interface LoginPayload {
  email: string;
  password?: string;
}

export interface SignupPayload {
  fullName: string;
  username: string;
  email: string;
  password?: string;
  pincode?: string;
  city?: string;
  country?: string;
  gender?: string;
  phoneNumber?: string;
  dateOfBirth?: string; // Format: YYYY-MM-DD
}

export const ENABLED_SOCIAL_PROVIDERS: AuthProvider[] = ["google", "linkedin"];
