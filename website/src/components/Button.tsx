import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  full?: boolean;
}

export function Button({ variant = 'primary', size = 'md', icon: Icon, children, full, className, ...props }: ButtonProps) {
  const baseClasses = "font-sans font-semibold rounded-[var(--mg-radius-sm)] border border-transparent cursor-pointer transition-all duration-200 ease-[var(--mg-ease-out)] inline-flex items-center justify-center gap-2 whitespace-nowrap";

  const sizeClasses = {
    sm: "text-[13px] px-[14px] py-[7px]",
    md: "text-[14px] px-[20px] py-[10px]",
    lg: "text-[15px] px-[26px] py-[13px]",
  };

  const variantClasses = {
    primary: "bg-[var(--mg-orange-500)] text-[#0a0a0a] shadow-[var(--mg-shadow-glow-orange)] hover:bg-[var(--mg-orange-400)] mg-shine-btn",
    secondary: "bg-[var(--mg-surface-2)] text-[var(--mg-fg-1)] border-[var(--mg-border-hairline)] shadow-[var(--mg-shadow-card)] hover:bg-[var(--mg-surface-3)]",
    ghost: "bg-transparent text-[var(--mg-fg-2)] hover:text-[var(--mg-fg-1)] hover:bg-[var(--mg-surface-1)]",
    glass: "bg-[var(--mg-surface-1)] text-[var(--mg-fg-1)] border-[var(--mg-border-hairline)] backdrop-blur-[20px] hover:bg-[var(--mg-surface-2)]",
  };

  return (
    <button
      className={cn(
        baseClasses,
        sizeClasses[size],
        variantClasses[variant],
        full && "w-full",
        className
      )}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}
