import { cn } from '@/lib/utils';

type StatusType = 'ok' | 'warning' | 'danger';

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  className?: string;
}

const statusConfig: Record<StatusType, { classes: string }> = {
  ok: { classes: 'status-ok' },
  warning: { classes: 'status-warning' },
  danger: { classes: 'status-danger' },
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusConfig[status].classes,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
