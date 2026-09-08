import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyFreeTimeDraft, listFreeTimeActivities } from "../api/freeTime";
import { refreshSchedule } from "../api/schedule";
import type { FreeTimeActivityDTO } from "../api/types";
import FreeTimeView from "./FreeTimeView";

vi.mock("../api/freeTime", () => ({
  applyFreeTimeDraft: vi.fn(),
  listFreeTimeActivities: vi.fn(),
}));
vi.mock("../api/schedule", () => ({ refreshSchedule: vi.fn() }));
vi.mock("../api/plans", () => ({
  searchPlans: vi.fn().mockResolvedValue({
    results: [
      {
        plan_id: "prerequisite-1",
        name: "Preparation",
        plan_kind: "TASK",
        parent_id: null,
      },
    ],
  }),
}));
const activity: FreeTimeActivityDTO = {
  free_time_activity_id: "activity-1",
  name: "Reading",
  enabled: true,
  real_fraction: "1",
  minimum_block_size_minutes: 15,
  allowed_block_families: [],
  prerequisite_plan_ids: [],
  created_at: "2026-09-01T12:00:00Z",
  updated_at: "2026-09-01T12:00:00Z",
};
const listMock = vi.mocked(listFreeTimeActivities);
const saveMock = vi.mocked(applyFreeTimeDraft);
const renderView = () =>
  render(
    <MemoryRouter>
      <FreeTimeView />
    </MemoryRouter>,
  );

describe("FreeTimeView draft editing", () => {
  it("retains committed activities when the subsequent calendar refresh fails", async () => {
    const user = userEvent.setup();
    saveMock.mockResolvedValue({
      applied_count: 1,
      activities: [{ ...activity, name: "Saved activity" }],
    });
    vi.mocked(refreshSchedule).mockRejectedValueOnce(
      new Error("Refresh offline"),
    );
    renderView();
    await screen.findByRole("heading", { name: "Reading" });
    await user.click(screen.getByRole("button", { name: "Edit activities" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Saved activity" },
    });
    await user.click(screen.getByRole("button", { name: "Save activities" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Refresh offline",
    );
    expect(
      screen.getByRole("heading", { name: "Saved activity" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Save activities" }),
    ).not.toBeInTheDocument();
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(refreshSchedule).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Edit activities" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Saved activity");
    expect(
      screen.getByRole("button", { name: "Save activities" }),
    ).toBeDisabled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(refreshSchedule).mockResolvedValue({
      run_started_at: "2026-09-01T12:00:00Z",
      resolved_blocks: null,
      block_assignment: null,
      resolved: null,
      assignment: null,
      free_time: null,
    });
    listMock.mockResolvedValue({ activities: [activity] });
    saveMock.mockResolvedValue({ applied_count: 1, activities: [activity] });
  });
  it("edits existing activity fields locally and submits one atomic request", async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByRole("heading", { name: "Reading" });
    await user.click(screen.getByRole("button", { name: "Edit activities" }));
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Writing" },
    });
    fireEvent.change(screen.getByLabelText("Minimum block (min)"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("Block families"), {
      target: { value: "home, focus" },
    });
    expect(saveMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save activities" }));
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith([
      {
        op: "update",
        activity_ref: "activity-1",
        name: "Writing",
        real_fraction: "1",
        minimum_block_size_minutes: 0,
      },
      {
        op: "set_block_families",
        activity_ref: "activity-1",
        families: ["home", "focus"],
      },
    ]);
  });
  it("creates and edits families and prerequisites before saving a new row", async () => {
    listMock.mockResolvedValue({ activities: [] });
    const user = userEvent.setup();
    renderView();
    await screen.findByText("No free-time activities configured.");
    await user.click(screen.getByRole("button", { name: "Edit activities" }));
    await user.click(
      screen.getByRole("button", { name: "Add free-time activity" }),
    );
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Practice" },
    });
    fireEvent.change(screen.getByLabelText("Block families"), {
      target: { value: "studio" },
    });
    fireEvent.change(screen.getByLabelText("Prerequisite plan"), {
      target: { value: "prep" },
    });
    await user.click(
      await screen.findByRole("button", { name: /Preparation/ }),
    );
    expect(saveMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save activities" }));
    const edits = saveMock.mock.calls[0][0];
    expect(edits[0]).toMatchObject({
      op: "create",
      draft_ref: expect.stringMatching(/^draft:/),
      name: "Practice",
      real_fraction: "1",
      enabled: true,
    });
    const ref = edits[0].op === "create" ? edits[0].draft_ref : "";
    expect(edits.slice(1)).toEqual([
      { op: "set_block_families", activity_ref: ref, families: ["studio"] },
      {
        op: "add_prerequisite",
        activity_ref: ref,
        prerequisite_plan_id: "prerequisite-1",
      },
    ]);
  });
  it("shows enabled totals and updates them for deletions and undo", async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByRole("heading", { name: "Reading" });
    await user.click(screen.getByRole("button", { name: "Edit activities" }));
    expect(screen.getByLabelText("Total enabled fraction")).toHaveTextContent(
      "1",
    );
    fireEvent.change(screen.getByLabelText("Real fraction"), {
      target: { value: "0.5" },
    });
    expect(screen.getByLabelText("Total enabled fraction")).toHaveTextContent(
      "0.5",
    );
    expect(screen.getByText("Total enabled fraction is not 1.")).toBeVisible();
    await user.click(screen.getByLabelText("Enabled"));
    expect(screen.getByLabelText("Total enabled fraction")).toHaveTextContent(
      "0",
    );
    await user.click(screen.getByRole("button", { name: "Delete activity" }));
    expect(screen.getByText("Pending deletion")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Undo delete" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Reading");
    await user.click(screen.getByRole("button", { name: "Delete activity" }));
    await user.click(screen.getByRole("button", { name: "Save activities" }));
    expect(saveMock).toHaveBeenCalledWith([
      { op: "delete", activity_ref: "activity-1" },
    ]);
  });
  it("removes unsaved rows without sending create/delete calls", async () => {
    listMock.mockResolvedValue({ activities: [] });
    const user = userEvent.setup();
    renderView();
    await screen.findByText("No free-time activities configured.");
    await user.click(screen.getByRole("button", { name: "Edit activities" }));
    await user.click(
      screen.getByRole("button", { name: "Add free-time activity" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete activity" }));
    await user.click(screen.getByRole("button", { name: "Save activities" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Edit activities" }),
      ).toBeVisible(),
    );
    expect(saveMock).not.toHaveBeenCalled();
  });
  it("keeps draft values after save fails and rejects malformed numeric text", async () => {
    saveMock.mockRejectedValue(new Error("Atomic save failed"));
    const user = userEvent.setup();
    renderView();
    await screen.findByRole("heading", { name: "Reading" });
    await user.click(screen.getByRole("button", { name: "Edit activities" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Unsent edit" },
    });
    await user.click(screen.getByRole("button", { name: "Save activities" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Atomic save failed",
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Unsent edit");
    fireEvent.change(screen.getByLabelText("Real fraction"), {
      target: { value: "nope" },
    });
    await user.click(screen.getByRole("button", { name: "Save activities" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "must be a valid number",
    );
    expect(saveMock).toHaveBeenCalledTimes(1);
  });
});
