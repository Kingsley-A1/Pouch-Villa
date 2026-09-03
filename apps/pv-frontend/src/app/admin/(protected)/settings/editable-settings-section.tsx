import { PencilSimple } from "@phosphor-icons/react/dist/ssr";

export function EditableSettingsSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-(--pv-line) bg-(--pv-surface)">
      <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)">
        <span>
          <span className="block text-lg font-bold">{title}</span>
          <span className="mt-1 block text-sm text-(--pv-muted)">{summary}</span>
        </span>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-(--pv-line) text-(--pv-muted) group-open:text-(--pv-red)">
          <PencilSimple size={20} weight="bold" aria-hidden="true" />
          <span className="sr-only">Edit {title}</span>
        </span>
      </summary>
      <div className="border-t border-(--pv-line) p-5">{children}</div>
    </details>
  );
}
