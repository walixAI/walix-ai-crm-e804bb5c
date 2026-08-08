import { cn } from "@/lib/utils";

interface Props {
  name?: string | null;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}

export function tenantInitials(name?: string | null) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "W";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Logo del tenant contenido en un chip fijo: nunca desborda ni rompe la estética. */
export function TenantMark({ name, logoUrl, size = 32, className }: Props) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-xl border border-border bg-muted overflow-hidden grid place-items-center",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={name ?? "Instancia"}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name ? `Logo de ${name}` : "Logo"}
          className="h-full w-full object-contain p-[12%]"
        />
      ) : (
        <span
          className="font-semibold text-primary leading-none"
          style={{ fontSize: Math.max(10, Math.round(size * 0.38)) }}
        >
          {tenantInitials(name)}
        </span>
      )}
    </div>
  );
}
