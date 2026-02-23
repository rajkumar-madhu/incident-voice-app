import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Phone, BarChart3, Bot,
  Key, CreditCard, Settings, Headphones,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap = {
  LayoutDashboard, Phone, BarChart3, Bot, Key, CreditCard, Settings,
};

const navItems = [
  { path: '/dashboard', label: 'Overview', icon: 'LayoutDashboard' },
  { path: '/calls', label: 'Call Logs', icon: 'Phone' },
  { path: '/analytics', label: 'Analytics', icon: 'BarChart3' },
  { path: '/agents', label: 'Agents', icon: 'Bot' },
  { path: '/api-keys', label: 'API Keys', icon: 'Key' },
  { path: '/billing', label: 'Billing', icon: 'CreditCard' },
  { path: '/settings', label: 'Settings', icon: 'Settings' },
] as const;

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 border-r bg-background">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Headphones className="h-6 w-6 text-primary" />
        <span className="font-semibold text-lg">LinkedEye</span>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap];
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
