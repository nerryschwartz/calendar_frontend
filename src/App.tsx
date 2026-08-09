import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import BlockCalendarView from './views/BlockCalendarView'
import CalendarsView from './views/CalendarsView'
import NotificationsView from './views/NotificationsView'
import PlanTreeView from './views/PlanTreeView'
import TimersView from './views/TimersView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/calendars" replace />} />
          <Route path="calendars" element={<CalendarsView />} />
          <Route path="calendars/blocks" element={<BlockCalendarView />} />
          <Route path="plan-tree" element={<PlanTreeView />} />
          <Route path="plan-tree/:planId" element={<PlanTreeView />} />
          <Route path="timers" element={<TimersView />} />
          <Route path="notifications" element={<NotificationsView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
