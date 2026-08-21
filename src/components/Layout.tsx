import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { getNotifications } from "../api/notifications";
import PlanSearchInput from "./PlanSearchInput";
import ScheduleStatusBar from "./ScheduleStatusBar";

const navItems = [
  { to: "/calendars", label: "Calendars" },
  { to: "/calendars/blocks", label: "Block Calendar" },
  { to: "/plan-tree", label: "Plan Tree" },
  { to: "/timers", label: "Timers" },
  { to: "/notifications", label: "Notifications", badge: true },
  { to: "/free-time", label: "Free Time" },
  { to: "/settings", label: "Settings" },
];

export default function Layout() {
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    const load = () => {
      void getNotifications()
        .then((data) => setNotificationCount(data.notifications.length))
        .catch(() => setNotificationCount(0));
    };
    load();
    const id = window.setInterval(load, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-top">
          <h1>Calendar</h1>
          <div className="header-search">
            <PlanSearchInput placeholder="Jump to plan…" />
          </div>
        </div>
        <ScheduleStatusBar />
        <nav className="app-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {item.label}
              {item.badge && notificationCount > 0 && (
                <span className="nav-badge">{notificationCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
