import type { PropsWithChildren, ReactNode } from "react";

export const Card = ({
  children,
  title,
  actions,
}: PropsWithChildren<{ title?: string; actions?: ReactNode }>) => (
  <section className="card">
    {(title || actions) && (
      <header className="card__header">
        <div>{title ? <h3>{title}</h3> : null}</div>
        {actions ? <div>{actions}</div> : null}
      </header>
    )}
    {children}
  </section>
);

export const StatCard = ({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) => (
  <Card>
    <span className="eyebrow">{label}</span>
    <strong className="stat-value">{value}</strong>
    <p className="muted">{helper}</p>
  </Card>
);

export const Badge = ({ children, tone = "neutral" }: PropsWithChildren<{ tone?: string }>) => (
  <span className={`badge badge--${tone}`}>{children}</span>
);

export const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="section-title">
    <h2>{title}</h2>
    {subtitle ? <p>{subtitle}</p> : null}
  </div>
);
