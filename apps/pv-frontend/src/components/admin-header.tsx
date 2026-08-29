import type { ReactNode } from "react";
export function AdminHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">{description}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}
