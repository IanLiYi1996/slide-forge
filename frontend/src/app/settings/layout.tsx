/**
 * Settings Layout
 *
 * Provides a consistent layout for all settings pages
 */

'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Key, BarChart3, Zap } from 'lucide-react';

interface SettingsLayoutProps {
  children: ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Settings</h1>
          </div>
          <p className="text-muted-foreground">
            Manage your API configurations, usage, and quotas
          </p>
        </div>

        {/* Navigation Tabs */}
        <SettingsNav />

        {/* Content */}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function SettingsNav() {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/settings/api-config',
      label: 'API Configuration',
      icon: Key,
      description: 'Manage API keys',
    },
    {
      href: '/settings/usage',
      label: 'Usage Statistics',
      icon: BarChart3,
      description: 'View usage data',
    },
    {
      href: '/settings/quota',
      label: 'Quota Management',
      icon: Zap,
      description: 'Manage quotas',
    },
  ];

  return (
    <nav className="border-b">
      <div className="flex gap-1 overflow-x-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap
                ${
                  isActive
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
