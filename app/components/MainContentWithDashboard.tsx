"use client";

import { useState } from "react";
import { AttendanceDashboardSimple } from "./AttendanceDashboardSimple";
import { ClassHoursFromCsv } from "./ClassHoursFromCsv";

export function MainContentWithDashboard() {
  const [specialConsideration, setSpecialConsideration] = useState(false);

  return (
    <div className="space-y-6">
      <AttendanceDashboardSimple
        specialConsideration={specialConsideration}
        onSpecialConsiderationChange={setSpecialConsideration}
      />
      <ClassHoursFromCsv
        specialConsideration={specialConsideration}
        onSpecialConsiderationChange={setSpecialConsideration}
      />
    </div>
  );
}
