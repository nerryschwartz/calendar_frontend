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
    master_horizon_duration_minutes: 525600 + 43200 + 1440 + 60 + 5,
    exact_solver_time_limit_seconds: 30,
    exact_solver_model_size_limit: 5000,
    heuristic_enabled: true,
    free_time_week_start_day: "MONDAY",
    updated_at: "2026-08-23T17:00:00.000Z",
    ...overrides,
  };
}

describe("SettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettingsMock.mockResolvedValue(settings());
    updateSettingsMock.mockImplementation(async (body) =>
      settings({
        master_horizon_duration_minutes:
          body.master_horizon_duration_minutes ?? 0,
      }),
    );
  });

  it("round-trips compound master horizon fields to total minutes", async () => {
    const user = userEvent.setup();
    render(<SettingsView />);

    const years = await screen.findByLabelText("Years");
    const months = screen.getByLabelText("Months");
    const days = screen.getByLabelText("Days");
    const hours = screen.getByLabelText("Hours");
    const minutes = screen.getByLabelText("Minutes");

    expect(years).toHaveValue(1);
    expect(months).toHaveValue(1);
    expect(days).toHaveValue(1);
    expect(hours).toHaveValue(1);
    expect(minutes).toHaveValue(5);

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
          master_horizon_duration_minutes: 616565,
        }),
      );
    });
  });
});
