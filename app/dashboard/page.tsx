import { Header } from "../components/Header";
import { MainContentWithDashboard } from "../components/MainContentWithDashboard";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="flex flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-4xl">
          <MainContentWithDashboard />
        </div>
      </main>
    </div>
  );
}
