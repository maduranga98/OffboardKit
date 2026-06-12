import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, type, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
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
            className={clsx(
              "block w-full rounded-md border px-3 py-2 text-sm text-navy placeholder:text-mist transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal",
              error
                ? "border-ember focus:ring-ember/50 focus:border-ember"
                : "border-navy/20",
              isPassword && "pr-10",
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-mist hover:text-navy transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
        {error && <p className="text-sm text-ember">{error}</p>}
        {hint && !error && <p className="text-sm text-mist">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
