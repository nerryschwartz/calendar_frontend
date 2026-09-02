import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getNotifications } from "../api/notifications";
import Layout from "./Layout";

vi.mock("../api/notifications", () => ({
  getNotifications: vi.fn(),
}));

vi.mock("./PlanSearchInput", () => ({
  default: () => <input aria-label="Jump to plan" />,
}));

vi.mock("./ScheduleStatusBar", () => ({
  default: () => <div data-testid="schedule-status" />,
}));

const getNotificationsMock = vi.mocked(getNotifications);

function renderLayout(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/calendars/tasks" element={<div>Task calendar</div>} />
          <Route path="/calendars/blocks" element={<div>Block calendar</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function activeNavLinks() {
  return within(screen.getByRole("navigation"))
    .getAllByRole("link")
    .filter((link) => link.classList.contains("active"));
}

describe("Layout calendar nav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNotificationsMock.mockResolvedValue({ notifications: [] });
  });

  it("highlights only the task/free-time calendar tab on the task calendar", () => {
    renderLayout("/calendars/tasks");

    expect(activeNavLinks()).toEqual([
      screen.getByRole("link", { name: "Task & Free-Time Calendar" }),
    ]);
  });

  it("highlights only the block calendar tab on the block calendar", () => {
    renderLayout("/calendars/blocks");

    expect(activeNavLinks()).toEqual([
      screen.getByRole("link", { name: "Block Calendar" }),
    ]);
  });
});
