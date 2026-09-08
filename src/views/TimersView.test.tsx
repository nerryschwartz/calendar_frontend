import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { completeTimer, getActiveTimers } from "../api/timers";
import type {
  ActiveTimerDTO,
  CalendarEntryDTO,
  ScheduleStateDTO,
} from "../api/types";
import TimersView from "./TimersView";

vi.mock("../api/timers", () => ({
  completeTimer: vi.fn(),
  getActiveTimers: vi.fn(),
}));

const getActiveTimersMock = vi.mocked(getActiveTimers);
const completeTimerMock = vi.mocked(completeTimer);

function timer(overrides: Partial<ActiveTimerDTO> = {}): ActiveTimerDTO {
  return {
    timer_key: "timer-1",
    source_kind: "FREE_TIME",
    plan_id: null,
    display_label: "Free time",
    window_start_at: "2099-01-01T12:00:00Z",
    window_end_at: "2099-01-01T13:00:00Z",
    calendar_entry_id: "entry-1",
    block_calendar_entry_id: null,
    ...overrides,
  };
}

function renderTimers() {
  render(
    <MemoryRouter>
      <TimersView />
    </MemoryRouter>,
  );
}

function scheduleState(
  overrides: Partial<ScheduleStateDTO> = {},
): ScheduleStateDTO {
  return {
    active_calendar_run_id: "run-1",
    last_refresh_failed: false,
    last_failure_at: null,
    last_failure_reason: null,
    updated_at: "2026-09-04T12:00:00.000Z",
    ...overrides,
  };
}

function calendarEntry(
  overrides: Partial<CalendarEntryDTO> = {},
): CalendarEntryDTO {
  return {
    calendar_entry_id: "entry-1",
    entry_type: "TASK",
    start_time: "2026-09-04T12:30:00.000Z",
    end_time: "2026-09-04T13:00:00.000Z",
    source_plan_id: "plan-1",
    source_free_time_activity_id: null,
    display_label: "Write notes",
    calendar_run_id: "run-1",
    ...overrides,
  };
}

function installNotification(
  permission: NotificationPermission,
  requestPermission = vi.fn<() => Promise<NotificationPermission>>(),
) {
  class TestNotification {
    static permission = permission;
    static requestPermission = requestPermission;
  }
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: TestNotification,
  });
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
  return requestPermission;
}

describe("TimersView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveTimersMock
      .mockReset()
      .mockResolvedValue({
        timers: [],
        diagnostics: { schedule_state: scheduleState(), nearby_entries: [] },
      });
    completeTimerMock.mockReset().mockResolvedValue({ notification: null });
    installNotification(
      "default",
      vi.fn(async () => "granted"),
    );
  });

  it("shows schedule diagnostics and nearby calendar entries when no timer is active", async () => {
    getActiveTimersMock.mockResolvedValue({
      timers: [],
      diagnostics: {
        schedule_state: scheduleState(),
        nearby_entries: [
          calendarEntry({
            calendar_entry_id: "later",
            display_label: "Later task",
            start_time: "2026-09-05T12:00:00.000Z",
          }),
          calendarEntry({ display_label: "Write notes" }),
        ],
      },
    });

    renderTimers();

    expect(await screen.findByText("No active timer right now.")).toBeVisible();
    expect(screen.getByText("run-1")).toBeVisible();
    expect(screen.getByText("Nearby calendar entries")).toBeVisible();
    expect(screen.getByText("Write notes")).toBeVisible();
  });

  it("sets loading, clears stale feedback, and surfaces reload failures", async () => {
    const user = userEvent.setup();
    let rejectReload: (reason?: unknown) => void = () => undefined;
    getActiveTimersMock.mockResolvedValueOnce({
      timers: [
        {
          timer_key: "timer-1",
          source_kind: "TASK",
          plan_id: "plan-1",
          display_label: "Active work",
          window_start_at: "2099-09-04T12:00:00.000Z",
          window_end_at: "2099-09-04T13:00:00.000Z",
          calendar_entry_id: "entry-1",
          block_calendar_entry_id: null,
        },
      ],
    });
    getActiveTimersMock.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectReload = reject;
      }),
    );

    renderTimers();

    expect(await screen.findByText("Active work")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reload" }));

    expect(screen.getByRole("button", { name: "Reloading…" })).toBeDisabled();
    rejectReload(new Error("Network down"));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network down");
    });
  });

  it("reports granted notification permission requests", async () => {
    const user = userEvent.setup();
    const requestPermission = installNotification(
      "default",
      vi.fn(async () => "granted"),
    );

    renderTimers();

    await screen.findByText("No active timer right now.");
    await user.click(
      screen.getByRole("button", { name: "Enable browser notifications" }),
    );

    expect(requestPermission).toHaveBeenCalled();
    expect(
      await screen.findByText("Browser notifications enabled."),
    ).toBeVisible();
  });

  it("keeps completion feedback and suppresses a still-active free-time timer", async () => {
    const user = userEvent.setup();
    getActiveTimersMock.mockResolvedValue({ timers: [timer()] });
    renderTimers();
    await user.click(await screen.findByRole("button", { name: "Complete" }));
    expect(await screen.findByText(/Completed free-time timer/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Complete" }),
    ).not.toBeInTheDocument();
    expect(completeTimerMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Reload" }));
    expect(
      screen.queryByText(/Completed free-time timer/),
    ).not.toBeInTheDocument();
    expect(completeTimerMock).toHaveBeenCalledTimes(1);
  });

  it("does not repeat automatic completion after reload fails", async () => {
    getActiveTimersMock
      .mockResolvedValueOnce({
        timers: [timer({ window_end_at: "2020-01-01T13:00:00Z" })],
      })
      .mockRejectedValue(new Error("Reload failed"));
    renderTimers();
    expect(await screen.findByRole("alert")).toHaveTextContent("Reload failed");
    expect(screen.getByText(/Completed free-time timer/)).toBeVisible();
    expect(completeTimerMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces completion failures and permits an explicit retry", async () => {
    const user = userEvent.setup();
    getActiveTimersMock.mockResolvedValue({
      timers: [timer({ window_end_at: "2020-01-01T13:00:00Z" })],
    });
    completeTimerMock.mockRejectedValueOnce(new Error("Completion offline"));
    renderTimers();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Completion offline",
    );
    expect(completeTimerMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Complete" }));
    expect(await screen.findByText(/Completed free-time timer/)).toBeVisible();
    expect(completeTimerMock).toHaveBeenCalledTimes(2);
  });

  it("shows active timers without optional diagnostics", async () => {
    getActiveTimersMock.mockResolvedValue({ timers: [timer()] });
    renderTimers();
    expect(await screen.findByText("Free time")).toBeVisible();
  });

  it("reports notification request errors and insecure contexts", async () => {
    const user = userEvent.setup();
    installNotification(
      "default",
      vi.fn().mockRejectedValue(new Error("Denied")),
    );
    renderTimers();
    await user.click(
      await screen.findByRole("button", {
        name: "Enable browser notifications",
      }),
    );
    expect(
      await screen.findByText(
        "Browser notification permission request failed.",
      ),
    ).toBeVisible();
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
    await user.click(
      screen.getByRole("button", { name: "Enable browser notifications" }),
    );
    expect(
      await screen.findByText(
        "Browser notifications require HTTPS or localhost.",
      ),
    ).toBeVisible();
  });

  it("explains denied notification state", async () => {
    const user = userEvent.setup();
    installNotification("denied");

    renderTimers();

    await screen.findByText("No active timer right now.");
    await user.click(
      screen.getByRole("button", { name: "Enable browser notifications" }),
    );
    expect(
      await screen.findByText(
        "Browser notifications are blocked in this browser.",
      ),
    ).toBeVisible();
  });

  it("hides notification permission controls when notifications are unsupported", async () => {
    delete (window as Partial<Window>).Notification;

    cleanup();
    renderTimers();

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Enable browser notifications" }),
      ).not.toBeInTheDocument();
    });
  });
});
