import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Heart, Mail } from "lucide-react";
import {
  confirmPasswordReset,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  verifyPasswordResetCode,
} from "firebase/auth";
import { auth } from "../../lib/firebase";
import { getAuthErrorMessage } from "../../lib/authErrors";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { useAlumniAuth } from "../../hooks/useAlumniAuth";
import logo from "../../assets/logo.png";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Landing page for the alumni invitation email.
 *
 * The invite carries a one-time `oobCode`, so the email is resolved from the
 * code itself (or from the `email` query param Firebase's own handler appends)
 * and shown read-only — the alumni only picks a password, then lands straight
 * in the portal.
 */
export default function AlumniSetPassword() {
  const { user, alumniProfile, loading: authLoading, authError } = useAlumniAuth();
  const [searchParams] = useSearchParams();

  const oobCode = searchParams.get("oobCode") || "";
  const companyId = searchParams.get("companyId") || "";
  const emailFromUrl = searchParams.get("email") || "";

  const [verifying, setVerifying] = useState(Boolean(oobCode));
  const [email, setEmail] = useState(emailFromUrl);
  const [codeError, setCodeError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const loginLink = useMemo(() => {
    const params = new URLSearchParams();
    if (companyId) params.set("companyId", companyId);
    if (email) params.set("email", email);
    const query = params.toString();
    return `/alumni-login${query ? `?${query}` : ""}`;
  }, [companyId, email]);

  useEffect(() => {
    if (!oobCode) return;
    let cancelled = false;

    verifyPasswordResetCode(auth, oobCode)
      .then((verifiedEmail) => {
        if (cancelled) return;
        setEmail(verifiedEmail);
        setCodeError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setCodeError(
          getAuthErrorMessage(err, "This link is no longer valid. Request a new one below.")
        );
      })
      .finally(() => {
        if (!cancelled) setVerifying(false);
      });

    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  // A successful password set can still bounce at the profile check (no alumni
  // record / not activated). The hook reports that through authError, so stop
  // the button spinning and let the banner explain.
  useEffect(() => {
    if (authError) setSubmitting(false);
  }, [authError]);

  const handleResend = useCallback(async () => {
    if (!email) {
      setError("Enter your email address so we can send a new link.");
      return;
    }
    setResending(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResent(true);
      showToast("success", "Link sent", `Check ${email.trim()} for a new setup link.`);
    } catch (err) {
      showToast("error", "Couldn't send link", getAuthErrorMessage(err));
    } finally {
      setResending(false);
    }
  }, [email]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      // Sign straight in so the alumni never re-types the email they just saw.
      await signInWithEmailAndPassword(auth, email, password);
      // useAlumniAuth validates the profile and the redirect below takes over.
    } catch (err) {
      setError(getAuthErrorMessage(err, "Couldn't set your password. Please try again."));
      setSubmitting(false);
    }
  };

  if (authLoading) return <LoadingSpinner fullScreen />;
  if (user && alumniProfile) return <Navigate to="/alumni-portal/profile" replace />;
  // No code to act on — either a stray visit, or Firebase's own action handler
  // already completed the reset and bounced back here. Either way the login
  // form (with the email pre-filled) is the right place to land.
  if (!oobCode) return <Navigate to={loginLink} replace />;

  const linkBroken = Boolean(codeError);

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-[60%] bg-navy flex-col justify-center px-16 xl:px-24">
        <h1 className="font-display text-4xl xl:text-5xl text-white leading-tight">
          One step to go.
        </h1>
        <p className="mt-4 text-mist text-lg max-w-md">
          Your alumni account is ready. Choose a password to access your profile,
          opportunities, and the wider network.
        </p>
        <ul className="mt-10 space-y-4">
          {[
            "Access your alumni profile",
            "Explore job opportunities",
            "Connect with other alumni",
          ].map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-white/90">
              <Heart size={20} className="text-teal flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center bg-warm px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8">
            <img src={logo} alt="OffboardSet Logo" className="w-10 h-10 object-contain" />
            <span className="font-display text-xl text-navy">OffboardSet</span>
          </div>

          {verifying ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <LoadingSpinner />
              <p className="text-sm text-mist">Checking your invitation link…</p>
            </div>
          ) : linkBroken ? (
            <>
              <h2 className="text-2xl font-semibold text-navy mb-1">Link expired</h2>
              <p className="text-sm text-mist mb-6">
                {codeError}
              </p>

              {resent ? (
                <div className="flex items-start gap-2 p-3 bg-teal/10 border border-teal/20 rounded-md text-sm text-navy">
                  <CheckCircle2 size={16} className="text-teal flex-shrink-0 mt-0.5" />
                  <span>
                    A new setup link is on its way to <strong>{email}</strong>.
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  <Input
                    label="Email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                  {error && <p className="text-sm text-ember">{error}</p>}
                  <Button
                    type="button"
                    fullWidth
                    size="lg"
                    loading={resending}
                    onClick={handleResend}
                  >
                    Email me a new link
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-navy mb-1">Set your password</h2>
              <p className="text-sm text-mist mb-6">
                Choose a password to finish setting up your alumni account.
              </p>

              <div className="mb-5 flex items-center gap-2.5 rounded-md border border-navy/10 bg-white px-3 py-2.5">
                <Mail size={16} className="text-teal flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-mist">Signing in as</p>
                  <p className="text-sm font-medium text-navy truncate">{email}</p>
                </div>
              </div>

              {(error || authError) && (
                <div className="mb-4 p-3 bg-ember/10 border border-ember/20 rounded-md text-sm text-ember">
                  {error || authError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Hidden field so password managers save the right account. */}
                <input type="email" value={email} autoComplete="username" readOnly hidden />
                <Input
                  label="Password"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
                  required
                />
                <Input
                  label="Confirm password"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <Button type="submit" fullWidth size="lg" loading={submitting}>
                  Set password & continue
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-sm text-center text-mist">
            Already set a password?{" "}
            <Link to={loginLink} className="text-teal hover:text-teal-light font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
