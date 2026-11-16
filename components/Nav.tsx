"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Icon from "./Icon";
import { usePreferences } from "./Preferences";
const groups = [
  {
    label: "WORKSPACE",
    links: [
      { href: "/", label: "Overview", icon: "grid" },
      { href: "/enter", label: "Monthly entry", icon: "edit" },
      { href: "/rankings", label: "Rankings & top 5", icon: "chart" },
      { href: "/scores", label: "Validation", icon: "check" },
      { href: "/finals", label: "Final results", icon: "trophy" },
    ],
  },
  {
    label: "MANAGE",
    links: [
      { href: "/offices", label: "Offices & people", icon: "people" },
      { href: "/calendar", label: "Working days", icon: "calendar" },
      { href: "/prizes", label: "Prizes", icon: "gift" },
      { href: "/settings", label: "Program settings", icon: "settings" },
    ],
  },
];
export function TopBar() {
  const pathname = usePathname();
  const { openCustomize } = usePreferences();
  const current = groups
    .flatMap((g) => g.links)
    .find((l) => l.href === pathname);
  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <span>Incentive Program</span>
        <span className="breadcrumb-slash">/</span>
        <b>{current?.label || "Sign in"}</b>
      </div>
      <div className="topbar-actions">
        <span className="year-label">
          <Icon name="calendar" size={15} /> 2026 Program
        </span>
        <button className="btn small secondary" onClick={openCustomize}>
          <Icon name="settings" size={16} />
          <span>Customize</span>
        </button>
        <span className="avatar" title="Program administrator">
          PA
        </span>
      </div>
    </header>
  );
}
export default function Nav() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  return (
    <aside className={`sidebar ${expanded ? "expanded" : ""}`}>
      <Link href="/" className="brand">
        <span className="brand-mark">
          <Icon name="leaf" size={25} />
        </span>
        <span>
          Feedback<span className="brand-sub">INCENTIVE PROGRAM</span>
        </span>
      </Link>
      <button
        className="mobile-menu icon-btn"
        aria-label="Toggle navigation"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <Icon name={expanded ? "close" : "menu"} />
      </button>
      <div className="sidebar-content">
        <div className="organization">
          <span className="org-mark">
            <Icon name="building" size={19} />
          </span>
          <div>
            <b>Provincial Government</b>
            <span>La Union, Philippines</span>
          </div>
          <span className="org-dot" />
        </div>
        <nav aria-label="Main navigation">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-label">{group.label}</p>
              {group.links.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`nav-link ${pathname === n.href ? "active" : ""}`}
                  aria-current={pathname === n.href ? "page" : undefined}
                  onClick={() => setExpanded(false)}
                >
                  <Icon name={n.icon} size={19} />
                  {n.label}
                  {pathname === n.href && <span className="active-dot" />}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <Icon name="leaf" size={22} />
            </span>
            <b>Better service. Together.</b>
            <p>Recognizing the people behind exceptional public service.</p>
            <Link href="/enter" onClick={() => setExpanded(false)}>
              Let’s make progress <Icon name="arrow" size={15} />
            </Link>
          </div>
          <div className="sidebar-footer">
            <span className="avatar small">PG</span>
            <div>
              <b>PGLU workspace</b>
              <span>Customer feedback · 2026</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
