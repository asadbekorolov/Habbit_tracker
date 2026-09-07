import { CalendarX2 } from "lucide-react";

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
}

export function EmptyState({ title, subtitle, icon: Icon = CalendarX2 }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-neutral-100/80 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 text-center my-3">
      <div className="w-12 h-12 rounded-full bg-neutral-200/70 dark:bg-neutral-800/80 flex items-center justify-center mb-2.5 text-neutral-500 dark:text-neutral-400">
        <Icon className="w-6 h-6 stroke-[1.6]"/>
      </div>
      <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{title}</p>
      {subtitle && (
        <span className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
          {subtitle}
        </span>
      )}
    </div>
  );
}
