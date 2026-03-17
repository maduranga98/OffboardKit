import { forwardRef, type InputHTMLAttributes } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

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
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "block w-full rounded-md border px-3 py-2 text-sm text-navy placeholder:text-mist transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal",
            error
              ? "border-ember focus:ring-ember/50 focus:border-ember"
              : "border-navy/20",
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-ember">{error}</p>}
        {hint && !error && <p className="text-sm text-mist">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
