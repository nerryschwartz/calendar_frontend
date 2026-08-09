import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/calendars', label: 'Calendars' },
  { to: '/calendars/blocks', label: 'Block Calendar' },
  { to: '/plan-tree', label: 'Plan Tree' },
  { to: '/timers', label: 'Timers' },
  { to: '/notifications', label: 'Notifications' },
]

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Calendar</h1>
        <nav className="app-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
