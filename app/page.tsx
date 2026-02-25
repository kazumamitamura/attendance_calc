import { Header } from "./components/Header";
import { AttendanceVisualDashboard } from "./components/AttendanceVisualDashboard";
import { ClassHoursFromCsv } from "./components/ClassHoursFromCsv";
import { RequiredDaysCalc } from "./components/RequiredDaysCalc";
import { CalendarWeekdayCount } from "./components/CalendarWeekdayCount";
import { SubjectAdjustmentForm } from "./components/SubjectAdjustmentForm";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="flex flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <AttendanceVisualDashboard />
          <ClassHoursFromCsv />
          <RequiredDaysCalc />
          <CalendarWeekdayCount />
          <SubjectAdjustmentForm />
        </div>
      </main>
    </div>
  );
}
