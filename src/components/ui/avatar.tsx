import { cn } from '@/lib/utils/cn';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-20 w-20 text-2xl',
};

export interface AvatarProps {
  initials: string;
  /** Hex background; comes from the record so it stays stable across renders. */
  color?: string;
  size?: AvatarSize;
  className?: string;
  /** Full name, announced to screen readers in place of the initials. */
  name?: string;
}

export function Avatar({ initials, color = '#3366f5', size = 'md', className, name }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={name ? `${name} avatar` : undefined}
      aria-hidden={name ? undefined : true}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none',
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}

/** Overlapping avatar group with a "+N" overflow chip. */
export function AvatarGroup({
  people,
  max = 4,
  size = 'sm',
}: {
  people: Array<{ initials: string; color: string; name: string }>;
  max?: number;
  size?: AvatarSize;
}) {
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((person, i) => (
        <Avatar
          key={`${person.name}-${i}`}
          initials={person.initials}
          color={person.color}
          size={size}
          name={person.name}
          className="ring-2 ring-surface"
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-surface-sunken font-semibold text-secondary-text ring-2 ring-surface',
            SIZES[size],
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
