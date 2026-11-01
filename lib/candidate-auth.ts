export const AUTH_ACTIONS = ["signup", "login", "forgot", "reset", "logout"] as const;
export type AuthAction = (typeof AUTH_ACTIONS)[number];
export type AuthError = "invalidEmail" | "weakPassword" | "passwordMismatch" | "invalidCredentials" | "emailNotConfirmed" | "emailUsed" | "rateLimit" | "invalidLink" | "wrongRole" | "unavailable" | "failed";

export function validateAuth(action: AuthAction, email: string, password: string, confirmation: string): AuthError | null {
  if (["signup", "login", "forgot"].includes(action) && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) return "invalidEmail";
  if (["signup", "reset"].includes(action)) {
    if (password.length < 8) return "weakPassword";
    if (password !== confirmation) return "passwordMismatch";
  }
  if (action === "login" && !password) return "invalidCredentials";
  return null;
}

export function authErrorCode(code?: string, status?: number): AuthError {
  if (status === 429 || ["over_email_send_rate_limit", "over_request_rate_limit"].includes(code ?? "")) return "rateLimit";
  if (code === "invalid_credentials") return "invalidCredentials";
  if (code === "email_not_confirmed") return "emailNotConfirmed";
  if (["user_already_exists", "email_exists"].includes(code ?? "")) return "emailUsed";
  if (code === "weak_password") return "weakPassword";
  if (["otp_expired", "otp_disabled", "flow_state_expired", "flow_state_not_found", "session_not_found"].includes(code ?? "")) return "invalidLink";
  return "failed";
}
