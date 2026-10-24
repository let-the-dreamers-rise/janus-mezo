import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  readonly label: string;
  readonly hint?: ReactNode;
  readonly error?: string;
  /// Unit shown inside the input on the right, such as "MUSD".
  readonly unit?: string;
  /// Optional control on the label row, such as a "Max" button.
  readonly action?: ReactNode;
}

/// A labelled text input with helper text and an inline error wired for screen readers.
/// Amounts use inputMode="decimal", never type="number".
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, unit, action, className, ...props },
  ref,
) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {action}
      </div>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          spellCheck={false}
          autoComplete="off"
          className={cn(
            "num h-11 w-full rounded-md border border-input bg-background px-3 text-base transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
            unit && "pr-16",
            error && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/40",
          )}
          {...props}
        />
        {unit ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
});
