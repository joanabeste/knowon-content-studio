"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Password input with a show/hide toggle (eye icon). Shares styling
 * with the plain <Input> component so it can be dropped in as a
 * drop-in replacement.
 *
 * `className` forwards to the outer wrapper so callers can override
 * width/height like they would on <Input />.
 */
export type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  PasswordInputProps
>(({ className, disabled, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);
  return (
    <div
      className={cn(
        "flex h-10 w-full items-center gap-0.5 rounded-md border border-input bg-background pl-3 pr-1 ring-offset-background transition-colors",
        "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn(
          "min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-sm text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground focus:border-0 focus:outline-none focus:ring-0 disabled:cursor-not-allowed",
          visible ? "font-mono" : "font-sans",
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        tabIndex={-1}
        aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
        title={visible ? "Verbergen" : "Anzeigen"}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
