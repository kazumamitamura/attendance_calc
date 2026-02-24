export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          出席日数・授業時数
        </h1>
        <nav className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <a
            href="/"
            className="rounded-md px-3 py-2 font-medium text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            ホーム
          </a>
          <a
            href="/dashboard"
            className="rounded-md px-3 py-2 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ダッシュボード
          </a>
        </nav>
      </div>
    </header>
  );
}
