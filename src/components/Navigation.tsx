'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Mic, BarChart3, Briefcase, Bell, Settings, LogOut, Menu, X, User } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/dashboard', icon: Mic, label: 'Voice' },
  { href: '/dashboard/market', icon: BarChart3, label: 'Market' },
  { href: '/dashboard/portfolio', icon: Briefcase, label: 'Portfolio' },
  { href: '/dashboard/alerts', icon: Bell, label: 'Alerts' },
];

export default function Navigation() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-background-secondary border-r border-accent/10 h-screen fixed left-0 top-0">
        {/* Logo */}
        <div className="p-6 border-b border-accent/10">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center">
              <Mic className="w-5 h-5 text-background" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Vivid</h1>
              <p className="text-xs text-foreground-muted">AI Market Analyst</p>
            </div>
          </Link>
        </div>
        
        {/* Nav Items */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : 'text-foreground-muted hover:text-foreground hover:bg-background-tertiary'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        {/* User Section */}
        <div className="p-4 border-t border-accent/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
              <User className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user?.email?.split('@')[0]}</p>
              <p className="text-xs text-foreground-muted truncate">{user?.email}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Link
              href="/dashboard/settings"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-background-tertiary hover:bg-background transition-colors text-sm"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
            <button
              onClick={() => signOut()}
              className="px-3 py-2 rounded-lg bg-background-tertiary hover:bg-danger/10 hover:text-danger transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
      
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background-secondary border-b border-accent/10">
        <div className="flex items-center justify-between p-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center">
              <Mic className="w-4 h-4 text-background" />
            </div>
            <span className="font-bold">Vivid</span>
          </Link>
          
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-background-tertiary"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="p-4 border-t border-accent/10 bg-background-secondary">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 ${
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : 'text-foreground-muted hover:text-foreground hover:bg-background-tertiary'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            
            <div className="border-t border-accent/10 mt-2 pt-4">
              <button
                onClick={() => {
                  signOut();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-danger hover:bg-danger/10 w-full"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </nav>
        )}
      </header>
      
      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background-secondary border-t border-accent/10">
        <div className="flex items-center justify-around p-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                  isActive ? 'text-accent' : 'text-foreground-muted'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
