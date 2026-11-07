/** FairNest mark: two rounded beams form a roof over the deposit it shelters. */
export function Mark({ className, size, color = 'currentColor' }: { className?: string; size?: number; color?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="3" y="17" width="26" height="10" rx="5" transform="rotate(-38 3 17)" fill={color} />
      <rect x="22.5" y="1" width="26" height="10" rx="5" transform="rotate(38 22.5 1)" fill={color} />
      <circle cx="24" cy="36" r="7" fill={color} />
    </svg>
  );
}
