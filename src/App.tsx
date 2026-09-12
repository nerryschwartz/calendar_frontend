import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import Layout from "./components/Layout";
import BrowserTimezone from "./components/BrowserTimezone";
import PlanDraftProvider from "./components/PlanDraftProvider";
import BlockCalendarView from "./views/BlockCalendarView";
import CalendarsView from "./views/CalendarsView";
import FreeTimeView from "./views/FreeTimeView";
import NotificationsView from "./views/NotificationsView";
import PlanTreeView from "./views/PlanTreeView";
import SettingsView from "./views/SettingsView";
import TimersView from "./views/TimersView";

function PlanTreeDetailRoute() {
  const { planId } = useParams();
  return <PlanTreeView planId={planId} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <BrowserTimezone>
      <PlanDraftProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/calendars/tasks" replace />} />
            <Route
              path="calendars"
              element={<Navigate to="/calendars/tasks" replace />}
            />
            <Route path="calendars/tasks" element={<CalendarsView />} />
            <Route path="calendars/blocks" element={<BlockCalendarView />} />
            <Route path="plan-tree" element={<PlanTreeView />} />
            <Route path="plan-tree/:planId" element={<PlanTreeDetailRoute />} />
            <Route path="timers" element={<TimersView />} />
            <Route path="notifications" element={<NotificationsView />} />
            <Route path="settings" element={<SettingsView />} />
            <Route path="free-time" element={<FreeTimeView />} />
          </Route>
        </Routes>
      </PlanDraftProvider>
      </BrowserTimezone>
    </BrowserRouter>
  );
}
