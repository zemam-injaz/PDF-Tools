import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: number | string;
  hoverable?: boolean;
  children: React.ReactNode;
}

export function GlassCard({ children, padding = 20, hoverable = false, className, onClick, ...props }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "mg-card relative overflow-hidden",
        hoverable && "hover:-translate-y-[2px] hover:cursor-pointer",
        className
      )}
      style={{ padding }}
      {...props}
    >
      {children}
    </div>
  );
}
