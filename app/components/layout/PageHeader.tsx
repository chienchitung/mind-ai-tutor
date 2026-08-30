interface PageHeaderProps {
  heading: string;
  text?: string;
  actions?: React.ReactNode;
}

export function PageHeader({
  heading,
  text,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-foreground md:text-3xl">{heading}</h1>
        {text && <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{text}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-shrink-0 sm:justify-end">{actions}</div>}
    </div>
  );
}
