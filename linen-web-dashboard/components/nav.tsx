/**
 * components/nav.tsx
 *
 * Top navigation shown on every protected page: section links, a
 * light/dark theme toggle, the signed-in account's email, and a
 * sign-out button.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/scan', label: 'Scan' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/history', label: 'Alert history' },
  { href: '/activity', label: 'Activity' },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-sm transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.92] dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700"
    >
      <span className="grid place-items-center">
        <span className={isDark ? 'hidden' : 'inline'}>🌙</span>
        <span className={isDark ? 'inline' : 'hidden'}>☀️</span>
      </span>
    </button>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const initial = user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/75 shadow-sm shadow-slate-200/40 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/75 dark:shadow-black/20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 shadow-sm shadow-teal-600/30 transition-transform group-hover:scale-105">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M7 6h6l4 4v9a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 6 19V7.5A1.5 1.5 0 0 1 7 6Z"
                  stroke="#fff"
                  strokeWidth="1.7"
                />
                <circle cx="9.5" cy="9.5" r="1.05" fill="#fff" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Linen RFID
            </span>
          </Link>
          <nav className="flex gap-1">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
                    active
                      ? 'bg-teal-50 text-teal-700 shadow-sm shadow-teal-900/5 dark:bg-teal-500/10 dark:text-teal-400 dark:shadow-none'
                      : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                  }`}
                >
                  {link.label}
                  {active && (
                    <span className="absolute inset-x-2.5 -bottom-[1px] h-[2px] rounded-full bg-teal-600 dark:bg-teal-400" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="hidden items-center gap-2 sm:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white dark:bg-slate-700">
              {initial}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</span>
          </div>
          <button
            onClick={() => signOut()}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.97] dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
