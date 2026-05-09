import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { useAlumniAuth } from "../../hooks/useAlumniAuth";
import logo from "../../assets/logo.png";

export default function AlumniRegister() {
  const { user, alumniProfile, loading, authError, setAuthError } = useAlumniAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already logged in with a valid alumni profile
  if (loading) return <LoadingSpinner fullScreen />;
  if (user && alumniProfile) return <Navigate to="/alumni-portal/profile" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setAuthError(null);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      // onAuthStateChanged will validate the alumni profile and either:
      // - set alumniProfile + redirect to /alumni-portal/profile
      // - sign out + set authError (no profile / not activated)
    } catch (err: unknown) {
      let message = "Failed to create account. Please try again.";
      if (err instanceof Error) {
        if (err.message.includes("auth/email-already-in-use")) {
          message = "An account already exists with this email. Please sign in instead.";
        } else if (err.message.includes("auth/invalid-email")) {
          message = "Please enter a valid email address.";
        } else if (err.message.includes("auth/weak-password")) {
          message = "Password is too weak. Please use at least 6 characters.";
        } else {
          message = err.message;
        }
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-[60%] bg-navy flex-col justify-center px-16 xl:px-24">
        <h1 className="font-display text-4xl xl:text-5xl text-white leading-tight">
          Join the alumni network.
        </h1>
        <p className="mt-4 text-mist text-lg max-w-md">
          Stay connected with your former company, access exclusive opportunities, and keep your
          professional network strong.
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
            <img src={logo} alt="OffboardKit Logo" className="w-10 h-10 object-contain" />
            <span className="font-display text-xl text-navy">OffboardKit</span>
          </div>

          <h2 className="text-2xl font-semibold text-navy mb-1">Create Your Account</h2>
          <p className="text-sm text-mist mb-8">
            Enter your email and create a password to access the alumni portal.
          </p>

          {(error || authError) && (
            <div className="mb-4 p-3 bg-ember/10 border border-ember/20 rounded-md text-sm text-ember">
              {error || authError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <Button type="submit" fullWidth size="lg" loading={submitting}>
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-sm text-center text-mist">
            Already have an account?{" "}
            <Link to="/alumni-login" className="text-teal hover:text-teal-light font-medium">
              Sign in
            </Link>
          </p>

          <p className="mt-8 text-xs text-center text-mist/70">
            Return to{" "}
            <Link to="/login" className="text-teal hover:text-teal-light font-medium">
              company login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
