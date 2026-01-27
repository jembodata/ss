import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const styles =
      variant === "outline"
        ? "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
        : variant === "ghost"
          ? "bg-transparent text-slate-700 hover:bg-slate-100"
          : "bg-emerald-700 text-white hover:bg-emerald-800";
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
          styles,
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
