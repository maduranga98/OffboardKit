import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, type, ...props }, ref) => {
    const reactId = useId();
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-") || reactId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";

    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-navy"
          >
            {label}
          </label>
        )}
        <div className={isPassword ? "relative" : undefined}>
          <input
            ref={ref}
            id={inputId}
            type={isPassword ? (showPassword ? "text" : "password") : type}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              error ? errorId : hint ? hintId : undefined
            }
            className={clsx(
              // text-base on small screens keeps iOS Safari from zooming the
              // viewport on focus; desktop keeps the original 14px scale.
              "block w-full rounded-md border px-3 py-2.5 sm:py-2 text-base sm:text-sm",
              "text-navy placeholder:text-mist transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal",
              error
                ? "border-ember focus:ring-ember/50 focus:border-ember"
                : "border-navy/20",
              isPassword && "pr-11",
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-mist hover:text-navy transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
        {error && (
          <p id={errorId} className="text-sm text-ember">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-sm text-mist">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
