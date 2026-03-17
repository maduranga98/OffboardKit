import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { useAuth } from "../../hooks/useAuth";

const features = [
  "Structured offboarding checklists",
  "Knowledge capture before the last day",
  "Access revocation tracking",
];

export default function Login() {
  const { user, loading, companyId, signInWithGoogle, signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <LoadingSpinner fullScreen />;
  if (user && companyId) return <Navigate to="/dashboard" replace />;
  if (user && !companyId) return <Navigate to="/setup" replace />;

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
      const message = err instanceof Error ? err.message : "Sign in failed.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google sign in failed.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-[60%] bg-navy flex-col justify-center px-16 xl:px-24">
        <h1 className="font-display text-4xl xl:text-5xl text-white leading-tight">
          Exit with intention.
        </h1>
        <p className="mt-4 text-mist text-lg max-w-md">
          OffboardKit gives HR teams a structured, humane way to manage every
          employee departure — from checklist to alumni.
        </p>
        <ul className="mt-10 space-y-4">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-white/90">
              <CheckCircle size={20} className="text-teal flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center bg-warm px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8">
            <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill="#0D9E8A" />
              <path d="M7 8h8v12H7V8z" stroke="white" strokeWidth="2" fill="none" />
              <path d="M15 12l4 2-4 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M19 14h3" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="font-display text-xl text-navy">OffboardKit</span>
          </div>

          <h2 className="text-2xl font-semibold text-navy mb-1">
            Sign in to your workspace
          </h2>
          <p className="text-sm text-mist mb-8">
            Welcome back. Let&apos;s pick up where you left off.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-ember/10 border border-ember/20 rounded-md text-sm text-ember">
              {error}
            </div>
          )}

          <Button
            variant="secondary"
            fullWidth
            size="lg"
            onClick={handleGoogleSignIn}
            disabled={submitting}
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-navy/10" />
            <span className="text-xs text-mist">or</span>
            <div className="flex-1 h-px bg-navy/10" />
          </div>

          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@company.com"
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
            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={submitting}
            >
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-sm text-center text-mist">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="text-teal hover:text-teal-light font-medium">
              Start free
            </Link>
          </p>

          <p className="mt-8 text-xs text-center text-mist/70">
            Trusted by HR teams worldwide
          </p>
        </div>
      </div>
    </div>
  );
}
