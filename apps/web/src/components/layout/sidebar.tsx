'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '⬡' },
  { href: '/chat', label: 'Chat', icon: '◎' },
  { href: '/agents', label: 'Agents', icon: '◈' },
  { href: '/workflows', label: 'Workflows', icon: '⬔' },
  { href: '/deploy', label: 'Deploy', icon: '⬡' },
  { href: '/settings', label: 'Settings', icon: '◎' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r border-gray-800 bg-gray-900 flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-gray-800">
        <span className="text-sm font-semibold text-orange-400 tracking-wide">
          AgentCore
        </span>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-orange-500/10 text-orange-400'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-800">
        <p className="text-xs text-gray-600">agentcore-creator v0.1.0</p>
      </div>
    </aside>
  );
}
