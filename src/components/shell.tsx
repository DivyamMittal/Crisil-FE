import { NavLink, Outlet } from "react-router-dom";

import type { ReactNode } from "react";

export const PortalShell = ({
  title,
  subtitle,
  navigation,
  footer,
  actions,
}: {
  title: string;
  subtitle: string;
  navigation: Array<{ to: string; label: string }>;
  footer?: ReactNode;
  actions?: ReactNode;
}) => (
  <div className="shell">
    <aside className="sidebar">
      <div className="brand">TrackDesk</div>
      <nav className="nav">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            className={({ isActive }) => `nav__link${isActive ? " nav__link--active" : ""}`}
            to={item.to}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar__footer">{footer}</div>
    </aside>
    <main className="main">
      <header className="main__header">
        <div className="header-row">
          <div>
            <p className="eyebrow">{title}</p>
            <h1>{subtitle}</h1>
          </div>
          {actions ? <div>{actions}</div> : null}
        </div>
      </header>
      <Outlet />
    </main>
  </div>
);
