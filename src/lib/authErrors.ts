/**
 * Firebase Auth errors surface as `Firebase: Error (auth/invalid-credential).`
 * Showing that raw string is the "auth error" alumni were hitting, so every
 * auth screen runs failures through this mapper instead.
 */
const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/user-disabled": "This account has been disabled. Please contact your former company.",
  "auth/user-not-found": "No account found with this email. Check the address or use your invitation link.",
  "auth/wrong-password": "Incorrect password. Try again or reset your password.",
  "auth/invalid-credential": "Incorrect email or password. Try again or reset your password.",
  "auth/invalid-login-credentials": "Incorrect email or password. Try again or reset your password.",
  "auth/missing-password": "Please enter your password.",
  "auth/email-already-in-use": "An account already exists with this email. Please sign in instead.",
  "auth/weak-password": "Password is too weak. Please use at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/expired-action-code": "This link has expired. Request a new invitation link below.",
  "auth/invalid-action-code": "This link is invalid or has already been used. Request a new one below.",
  "auth/operation-not-allowed": "Email sign-in is not enabled. Please contact support.",
};

export function getAuthErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  // Older SDK paths only carry the code inside the message.
  if (error instanceof Error) {
    const match = error.message.match(/auth\/[a-z-]+/);
    if (match) return match[0];
  }
  return null;
}

export function getAuthErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  const code = getAuthErrorCode(error);
  return (code && MESSAGES[code]) || fallback;
}
