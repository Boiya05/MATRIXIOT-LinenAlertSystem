/**
 * components/nav.tsx
 *
 * Top navigation shown on every protected page: section links, the
 * signed-in account's email, and a sign-out button.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/contexts/auth-context';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/scan', label: 'Scan' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/history', label: 'Alert history' },
  { href: '/activity', label: 'Activity' },
];

export function Nav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M7 6h6l4 4v9a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 6 19V7.5A1.5 1.5 0 0 1 7 6Z"
                  stroke="#fff"
                  strokeWidth="1.7"
                />
                <circle cx="9.5" cy="9.5" r="1.05" fill="#fff" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight text-slate-900">
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
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-slate-400 sm:inline">{user?.email}</span>
          <button
            onClick={() => signOut()}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
