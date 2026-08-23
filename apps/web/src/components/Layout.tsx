import { Banknote, BarChart3, ClipboardPenLine, Gamepad2, ShieldCheck } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: '开始猜', icon: Gamepad2 },
  { to: '/stats', label: '统计', icon: BarChart3 },
  { to: '/submit', label: '投稿', icon: ClipboardPenLine },
  { to: '/privacy', label: '隐私', icon: ShieldCheck },
];

export function Layout() {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <NavLink to="/" className="brand-mark" aria-label="猜薪资首页">
            <span className="brand-icon">
              <Banknote size={22} strokeWidth={2.2} />
            </span>
            <span>猜薪资</span>
          </NavLink>
          <nav aria-label="主要导航" className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                aria-label={label}
                title={label}
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
              >
                <Icon size={17} aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
      >
        <Outlet />
      </main>
      <footer className="mx-auto flex max-w-[1180px] items-center justify-between border-t border-line px-4 py-5 text-xs text-muted sm:px-6 lg:px-8">
        <span>真实投稿，部分薪资来自薪飞扬公众号，仅供职业信息交流</span>
        <div className="flex gap-4">
          <NavLink to="/report" className="text-link">
            举报
          </NavLink>
          <NavLink to="/privacy" className="text-link">
            隐私
          </NavLink>
        </div>
      </footer>
    </div>
  );
}
