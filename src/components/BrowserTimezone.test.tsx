import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getSettings, updateSettings } from "../api/settings";
import BrowserTimezone from "./BrowserTimezone";
vi.mock("../api/settings", () => ({ getSettings: vi.fn(), updateSettings: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it("synchronizes before mounting views and rechecks on focus", async () => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  vi.mocked(getSettings).mockResolvedValue({ local_timezone: "EST" } as Awaited<ReturnType<typeof getSettings>>);
  render(<BrowserTimezone><p>Schedule view</p></BrowserTimezone>);
  expect(screen.queryByText("Schedule view")).not.toBeInTheDocument();
  await screen.findByText("Schedule view");
  expect(updateSettings).toHaveBeenCalledWith({ local_timezone: zone });
  vi.mocked(getSettings).mockResolvedValue({ local_timezone: zone } as Awaited<ReturnType<typeof getSettings>>);
  fireEvent.focus(window);
  await waitFor(() => expect(getSettings).toHaveBeenCalledTimes(2));
  expect(updateSettings).toHaveBeenCalledTimes(1);
});
it("shows failure and retries without mounting views prematurely", async () => {
  vi.mocked(getSettings).mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ local_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } as Awaited<ReturnType<typeof getSettings>>);
  render(<BrowserTimezone><p>Schedule view</p></BrowserTimezone>);
  expect(await screen.findByRole("alert")).toHaveTextContent("offline");
  expect(screen.queryByText("Schedule view")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Retry timezone sync"));
  await screen.findByText("Schedule view");
});
