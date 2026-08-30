import type { ReactNode } from 'react';

interface EditorSection {
  id: string;
  label: string;
}

interface EditorWorkspaceProps {
  title: string;
  description?: string;
  sections: EditorSection[];
  actions?: ReactNode;
}

export function EditorWorkspace({ title, description, sections, actions }: EditorWorkspaceProps) {
  return (
    <div className="app-panel z-20 mb-6 p-4 sm:p-5 lg:sticky lg:top-[4.25rem]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="app-kicker">Editor</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Editor sections">
        {sections.map((section, index) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
              {index + 1}
            </span>
            {section.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
