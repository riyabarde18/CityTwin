import React from 'react';
import { Database, Play, Activity, AlertCircle, LogIn, LogOut, Phone, MapPinned } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type AppPage = 'dashboard' | 'report' | 'my-reports' | 'inbox';

interface NavLink {
  href: string;
  label: string;
}

const NAV_LINKS: NavLink[] = [
  { href: '#map', label: 'City Map' },
  { href: '#pattern-intelligence', label: 'Pattern Intelligence' },
  { href: '#government', label: 'Government Dashboard' },
  { href: '#report', label: 'Report an Issue' },
  { href: '#my-reports', label: 'My Reports' },
  { href: '#rewards', label: 'Earn Points' },
  { href: '#inbox', label: 'Department Inbox' },
];

interface NavbarProps {
  isSynthetic: boolean;
  onSeed: () => void;
  onAnalyze: () => void;
  onSimulate: () => void;
  hasPatternSelected: boolean;
  loadingState: string | null;
  onOpenLogin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isSynthetic,
  onSeed,
  onAnalyze,
  onSimulate,
  hasPatternSelected,
  loadingState,
  onOpenLogin
}) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 shadow-lg">
      {/* Primary bar: brand, section navigation (evenly spaced), account */}
      <div className="bg-navy-900 border-b border-navy-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

          {/* Brand */}
          <a href="#top" className="flex items-center space-x-2.5 group shrink-0">
            <div className="w-9 h-9 rounded-lg bg-sky-500 flex items-center justify-center text-white font-bold shadow-md shadow-sky-950/40 group-hover:bg-sky-400 transition">
              <MapPinned className="w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <span className="text-lg font-bold tracking-tight text-white">
                City<span className="text-sky-400">Twin</span>
              </span>
              <span className="block text-[10px] font-medium text-sky-200/60 -mt-0.5">
                Urban Intelligence Platform
              </span>
            </div>
          </a>

          {/* Section navigation — generously spaced, wraps on smaller screens */}
          <nav className="hidden lg:flex items-center gap-x-7 flex-1 justify-center">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[13px] font-medium text-sky-100/80 hover:text-white transition whitespace-nowrap"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Account */}
          <div className="flex items-center shrink-0">
            {user ? (
              <div className="flex items-center space-x-2">
                <span className="hidden md:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-100 bg-navy-800 border border-navy-600">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{user.phone_number}</span>
                </span>
                <button
                  onClick={logout}
                  title="Log out"
                  className="p-2 rounded-lg text-sky-200/70 hover:bg-navy-800 hover:text-rose-400 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-navy-900 bg-sky-400 hover:bg-sky-300 transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile section nav — same links, horizontally scrollable, spaced */}
        <nav className="lg:hidden flex items-center gap-x-6 overflow-x-auto px-4 pb-3 -mt-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs font-medium text-sky-100/80 hover:text-white transition whitespace-nowrap shrink-0"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      {/* Secondary bar: demo/action controls, visually separated so the main
          nav above never feels congested */}
      <div className="bg-navy-800/95 backdrop-blur border-b border-navy-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between gap-4">
          <div className="flex items-center gap-x-3 overflow-x-auto">
            <button
              onClick={onSeed}
              disabled={!!loadingState}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-100 bg-navy-700/70 border border-navy-600 hover:bg-navy-700 disabled:opacity-50 transition shrink-0"
            >
              {loadingState === 'seeding' ? (
                <span className="w-3.5 h-3.5 border-2 border-sky-200 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Database className="w-3.5 h-3.5 text-sky-300" />
              )}
              <span>Load demo data</span>
            </button>

            <button
              onClick={onAnalyze}
              disabled={!!loadingState}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-navy-900 bg-sky-400 hover:bg-sky-300 disabled:opacity-50 transition shrink-0"
            >
              {loadingState === 'analyzing' ? (
                <span className="w-3.5 h-3.5 border-2 border-navy-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Run CityTwin analysis</span>
            </button>

            <button
              onClick={onSimulate}
              disabled={!!loadingState || !hasPatternSelected}
              title={!hasPatternSelected ? 'Select a pattern hotspot first to simulate intervention' : ''}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-900/30 border border-emerald-700/50 hover:bg-emerald-900/50 disabled:opacity-40 transition shrink-0"
            >
              {loadingState === 'simulating' ? (
                <span className="w-3.5 h-3.5 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Activity className="w-3.5 h-3.5 text-emerald-300" />
              )}
              <span>Simulate intervention</span>
            </button>
          </div>

          {isSynthetic && (
            <span className="hidden md:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30 text-[11px] font-semibold shrink-0">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Demo data: synthetic</span>
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
