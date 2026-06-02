import Link from 'next/link';

export function Topbar() {
  return (
    <header className="h-14 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-3">
        <Link
          href="/deploy"
          className="px-3 py-1.5 text-xs font-medium bg-orange-500 hover:bg-orange-400 text-white rounded-md transition-colors"
        >
          Deploy
        </Link>
        <Link
          href="/settings"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm transition-colors"
          aria-label="Settings"
        >
          ⚙
        </Link>
      </div>
    </header>
  );
}
