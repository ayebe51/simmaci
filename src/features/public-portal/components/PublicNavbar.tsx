import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser } from '@/lib/authHelpers';
import { Button } from '@/components/ui/button';
import { LogIn, LayoutDashboard, Menu, X, Shield } from 'lucide-react';

export const PublicNavbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentUser = getCurrentUser();
  const navigate = useNavigate();

  const navLinks = [
    { label: 'Beranda', href: '#hero' },
    { label: 'Pimpinan', href: '#pimpinan' },
    { label: 'Statistik', href: '#statistik' },
    { label: 'Peta Sebaran', href: '#sebaran' },
    { label: 'Direktori', href: '#direktori' },
    { label: 'Layanan', href: '#layanan' },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-emerald-100/80 shadow-xs">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo Brand */}
          <a href="#hero" className="flex items-center gap-3 group">
            <img
              src="/images/logo-maarif-hijau.png"
              alt="Logo LP Ma'arif NU Cilacap"
              className="h-11 w-auto object-contain rounded-xs transition-transform group-hover:scale-105"
              onError={(e) => {
                // Fallback icon if specific green logo missing
                (e.target as HTMLImageElement).src = '/logo-maarif-hijau.png';
              }}
            />
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 group-hover:text-emerald-800 transition-colors">
                SIMMACI
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 tracking-wider uppercase leading-none">
                LP Ma'arif NU Cilacap
              </span>
            </div>
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="text-xs font-bold text-slate-600 hover:text-emerald-700 uppercase tracking-wider transition-colors py-1 relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-emerald-600 hover:after:w-full after:transition-all"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Action CTA */}
          <div className="hidden sm:flex items-center gap-3">
            {currentUser ? (
              <Button
                onClick={() => navigate('/dashboard')}
                className="h-11 px-5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs uppercase tracking-wider shadow-sm gap-2"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Buka Dashboard</span>
              </Button>
            ) : (
              <Button
                onClick={() => navigate('/login')}
                className="h-11 px-6 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs uppercase tracking-wider shadow-sm gap-2"
              >
                <LogIn className="w-4 h-4 text-emerald-400" />
                <span>Masuk SIMMACI</span>
              </Button>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex sm:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-emerald-100 bg-white/98 backdrop-blur-xl px-4 pt-3 pb-6 space-y-4 shadow-xl">
          <nav className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="text-sm font-bold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 px-3 py-2.5 rounded-xl transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="pt-2 border-t border-slate-100">
            {currentUser ? (
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/dashboard');
                }}
                className="w-full h-12 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs uppercase tracking-wider gap-2 shadow-sm"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Buka Dashboard</span>
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/login');
                }}
                className="w-full h-12 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs uppercase tracking-wider gap-2 shadow-sm"
              >
                <LogIn className="w-4 h-4 text-emerald-400" />
                <span>Masuk SIMMACI</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
