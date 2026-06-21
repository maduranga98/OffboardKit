import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Heart } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { showToast } from "../../components/ui/Toast";
import { useAlumniAuth } from "../../hooks/useAlumniAuth";
import { auth } from "../../lib/firebase";
import logo from "../../assets/logo.png";

export default function AlumniLogin() {
  const { user, alumniProfile, loading, authError, signInWithEmail } = useAlumniAuth();
  const [searchParams] = useSearchParams();
  const emailFromUrl = searchParams.get("email") || "";
  const companyIdFromUrl = searchParams.get("companyId") || "";
  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const redirectedFromCompanyLogin = searchParams.get("notice") === "alumni";

  if (loading) return <LoadingSpinner fullScreen />;
  if (user && alumniProfile) return <Navigate to="/alumni-portal/profile" replace />;

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      showToast("success", `Password reset email sent to ${forgotEmail}`);
      setShowForgot(false);
      setForgotEmail("");
    } catch {
      showToast("error", "Failed to send reset email. Check the address and try again.");
    } finally {
      setSendingReset(false);
    }
  };

  const handleEmailSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Sign in failed. Please check your credentials.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-[60%] bg-navy flex-col justify-center px-16 xl:px-24">
        <h1 className="font-display text-4xl xl:text-5xl text-white leading-tight">
          Welcome back, alumni.
        </h1>
        <p className="mt-4 text-mist text-lg max-w-md">
          Stay connected with your professional network and discover new
          opportunities within our alumni community.
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
            <img
              src={logo}
              alt="OffboardSet Logo"
              className="w-10 h-10 object-contain"
            />
            <span className="font-display text-xl text-navy">OffboardSet</span>
          </div>

          <h2 className="text-2xl font-semibold text-navy mb-1">
            Alumni Portal
          </h2>
          <p className="text-sm text-mist mb-8">
            Sign in to access your profile and alumni community.
          </p>

          {redirectedFromCompanyLogin && (
            <div className="mb-4 p-3 bg-teal/10 border border-teal/20 rounded-md text-sm text-navy">
              This is an alumni account. Please sign in here to access the alumni portal.
            </div>
          )}

          {(error || authError) && (
            <div className="mb-4 p-3 bg-ember/10 border border-ember/20 rounded-md text-sm text-ember">
              {error || authError}
            </div>
          )}

          {showForgot ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-sm text-mist">
                Enter your email address and we'll send you a reset link.
              </p>
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />
              <Button type="submit" fullWidth size="lg" loading={sendingReset}>
                Send Reset Link
              </Button>
              <button
                type="button"
                onClick={() => setShowForgot(false)}
                className="w-full text-sm text-mist hover:text-navy text-center"
              >
                Back to sign in
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-sm text-teal hover:text-teal-light font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <Button type="submit" fullWidth size="lg" loading={submitting}>
                Sign in
              </Button>
            </form>
          )}

          <p className="mt-6 text-sm text-center text-mist">
            First time here?{" "}
            <Link
              to={`/alumni-register${companyIdFromUrl ? `?companyId=${companyIdFromUrl}&email=${encodeURIComponent(emailFromUrl)}` : ""}`}
              className="text-teal hover:text-teal-light font-medium"
            >
              Create your account
            </Link>
          </p>

          <p className="mt-8 text-xs text-center text-mist/70">
            Return to{" "}
            <Link
              to="/login"
              className="text-teal hover:text-teal-light font-medium"
            >
              company login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
