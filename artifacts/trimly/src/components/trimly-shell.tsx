import { BarChart3, Home, List, Settings, Scissors } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';

const navItems = [
  { href: '/', label: 'Overview', icon: Home },
  { href: '/subscriptions', label: 'Subscriptions', icon: List },
  { href: '/insights', label: 'Insights', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function TrimlyShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="trimly-shell">
      <aside className="trimly-sidebar" aria-label="Primary navigation">
        <Link href="/" className="brand-mark" data-testid="link-brand">
          <span className="brand-symbol"><Scissors size={17} strokeWidth={2.5} /></span>
          <span className="brand-name">trimly</span>
        </Link>
        <div className="sidebar-kicker">Your money, uncluttered</div>
        <nav className="nav-list">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="nav-link" data-active={location === href} data-testid={`link-nav-${label.toLowerCase()}`}>
              <Icon className="nav-icon" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <p><strong>Small trims add up.</strong><br />You are already doing the hard part: looking.</p>
          </div>
          <div className="sidebar-foot">PRIVATE BY DEFAULT · LOCAL DATA</div>
        </div>
      </aside>
      <main className="trimly-main">{children}</main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="nav-link" data-active={location === href} data-testid={`link-mobile-${label.toLowerCase()}`}>
            <Icon className="nav-icon" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children, subtitle }: { eyebrow: string; title: ReactNode; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="page-top">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="top-actions">{children}</div>}
    </header>
  );
}