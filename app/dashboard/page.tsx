import { Header } from "../components/Header";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="flex flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-4xl">
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-medium text-zinc-500 dark:text-zinc-400">
              ダッシュボード
            </h2>
            <p className="mt-2 text-zinc-700 dark:text-zinc-300">
              開校日数・登校日数・授業時数を電卓のように計算するメイン画面です。
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-zinc-100/80 p-4 dark:bg-zinc-800/80">
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  開校日数
                </span>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  —
                </p>
              </div>
              <div className="rounded-xl bg-zinc-100/80 p-4 dark:bg-zinc-800/80">
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  登校日数
                </span>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  —
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
