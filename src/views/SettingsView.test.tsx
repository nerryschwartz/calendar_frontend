import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSettings, updateSettings } from "../api/settings";
import type { AppSettingsDTO } from "../api/types";
import SettingsView from "./SettingsView";

vi.mock("../api/settings", () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

const getSettingsMock = vi.mocked(getSettings);
const updateSettingsMock = vi.mocked(updateSettings);

function settings(overrides: Partial<AppSettingsDTO> = {}): AppSettingsDTO {
  return {
    local_timezone: "America/New_York",
    master_horizon_duration: {
      years: 1,
      months: 1,
      days: 1,
      hours: 1,
      minutes: 5,
    },
    exact_solver_time_limit_seconds: 30,
    exact_solver_model_size_limit: 5000,
    heuristic_enabled: true,
    free_time_week_start_day: "MONDAY",
    updated_at: "2026-08-23T17:00:00.000Z",
    ...overrides,
  };
}

describe("SettingsView", () => {
  it("shows the browser timezone without an editable selector", async () => {
    getSettingsMock.mockResolvedValue(settings({ local_timezone: "EST" }));
    const user = userEvent.setup();
    render(<SettingsView />);
    await screen.findByLabelText("Years");
    expect(screen.getByText(/Local timezone:/)).toHaveTextContent(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    expect(screen.queryByLabelText("Local timezone")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(updateSettingsMock.mock.calls[0][0]).not.toHaveProperty(
      "local_timezone",
    );
  });

  it("keeps invalid numeric input editable and rejects it before saving", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);
    const years = await screen.findByLabelText("Years");
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    await user.clear(years);
    await user.type(years, "1.5");
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Years must be a valid whole number",
    );
    expect(updateSettingsMock).not.toHaveBeenCalled();
    expect(years).toHaveValue("1.5");
  });

  it("reports a failed initial load and allows retry", async () => {
    const user = userEvent.setup();
    getSettingsMock.mockRejectedValueOnce(new Error("Settings offline"));
    render(<SettingsView />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Settings offline",
    );
    await user.click(screen.getByRole("button", { name: "Reload settings" }));
    expect(await screen.findByLabelText("Years")).toBeVisible();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    getSettingsMock.mockResolvedValue(settings());
    updateSettingsMock.mockImplementation(async (body) =>
      settings({
        ...body,
      }),
    );
  });

  it("[slow] round-trips calendar master horizon parts without flattening", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    const years = await screen.findByLabelText("Years");
    const months = screen.getByLabelText("Months");
    const days = screen.getByLabelText("Days");
    const hours = screen.getByLabelText("Hours");
    const minutes = screen.getByLabelText("Minutes");

    expect(years).toHaveValue("1");
    expect(months).toHaveValue("1");
    expect(days).toHaveValue("1");
    expect(hours).toHaveValue("1");
    expect(minutes).toHaveValue("5");

    await user.clear(years);
    await user.type(years, "1");
    await user.clear(months);
    await user.type(months, "2");
    await user.clear(days);
    await user.type(days, "3");
    await user.clear(hours);
    await user.type(hours, "4");
    await user.clear(minutes);
    await user.type(minutes, "5");
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(updateSettingsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          master_horizon_duration: {
            years: 1,
            months: 2,
            days: 3,
            hours: 4,
            minutes: 5,
          },
        }),
      );
    });
  });
});
