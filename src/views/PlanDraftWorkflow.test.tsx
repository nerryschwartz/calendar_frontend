import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPlanDetail, getMasterPlan, applyDraftEdits } from "../api/plans";
import PlanDraftProvider from "../components/PlanDraftProvider";
import { planDetail } from "../test/plan";
import PlanTreeView from "./PlanTreeView";
vi.mock("../api/repetitionReadiness", () => ({
  repetitionReadiness: vi.fn(async (edits) => ({
    blockers: [],
    effectiveEdits: edits,
  })),
}));

vi.mock("../api/plans", async (original) => ({
  ...(await original<typeof import("../api/plans")>()),
  getPlanDetail: vi.fn(),
  getMasterPlan: vi.fn(),
  applyDraftEdits: vi.fn(),
  searchPlans: vi.fn().mockResolvedValue({ results: [] }),
}));

function renderWorkflow() {
  render(
    <MemoryRouter initialEntries={["/plan-tree/plan-1?edit=1"]}>
      <PlanDraftProvider>
        <Link to="/elsewhere">Other view</Link>
        <Routes>
          <Route
            path="/plan-tree/plan-1"
            element={<PlanTreeView planId="plan-1" />}
          />
          <Route
            path="/elsewhere"
            element={<Link to="/plan-tree">Master plan</Link>}
          />
          <Route path="/plan-tree" element={<PlanTreeView />} />
        </Routes>
      </PlanDraftProvider>
    </MemoryRouter>,
  );
}

describe("plan draft workflow", () => {
  it("removes the last window as a group and queues its replacement as a new group", async () => {
    vi.mocked(getPlanDetail).mockResolvedValue(
      planDetail({
        time_constraint_groups: [
          {
            constraint_group_id: "group-1",
            plan_id: "plan-1",
            constraint_kind: "USER",
            windows: [
              {
                time_window_id: "window-1",
                start_time: "2026-09-10T10:00:00Z",
                end_time: "2026-09-10T11:00:00Z",
              },
            ],
          },
        ],
      }),
    );
    const user = userEvent.setup();
    renderWorkflow();
    await user.click(
      await screen.findByRole("button", { name: "Queue remove window" }),
    );
    expect(
      screen.getByText("Remove time constraint group group-1"),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Queue add window" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: "2026-09-11T10:00" },
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: "2026-09-11T11:00" },
    });
    await user.click(screen.getByRole("button", { name: "Queue add group" }));
    expect(screen.getByText("Pending edits (2)")).toBeVisible();
    expect(screen.getByText("Pending USER group")).toBeVisible();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlanDetail).mockResolvedValue(planDetail());
    vi.mocked(getMasterPlan).mockResolvedValue({
      master_plan_id: "master",
      plan: planDetail({ plan_id: "master", name: "Master", is_master: true }),
    });
  });
  it("queues time constraints and preserves them through route remounts", async () => {
    const user = userEvent.setup();
    renderWorkflow();
    fireEvent.change(await screen.findByLabelText("Start"), {
      target: { value: "2026-09-10T10:00" },
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: "2026-09-10T11:00" },
    });
    await user.click(screen.getByRole("button", { name: "Queue add group" }));
    expect(screen.getByRole("button", { name: "Save edits" })).toBeEnabled();
    expect(screen.getByText("Pending edits (1)")).toBeVisible();
    expect(applyDraftEdits).not.toHaveBeenCalled();
    await user.click(screen.getByRole("link", { name: "Other view" }));
    await user.click(screen.getByRole("link", { name: "Master plan" }));
    expect(
      await screen.findByRole("heading", { name: "Master" }),
    ).toBeVisible();
    expect(screen.getByText("Pending edits (1)")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Queue add group" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Add prerequisite", { selector: "legend" }),
    ).not.toBeInTheDocument();
  });
  it("does not re-enter edit mode after exiting an edit deep link", async () => {
    const user = userEvent.setup();
    renderWorkflow();
    await user.click(
      await screen.findByRole("button", { name: "Exit edit mode" }),
    );
    expect(await screen.findByRole("button", { name: "Edit" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Save edits" }),
    ).not.toBeInTheDocument();
  });
  it("reports invalid time windows without queueing or crashing", async () => {
    const user = userEvent.setup();
    renderWorkflow();
    await user.click(
      await screen.findByRole("button", { name: "Queue add group" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "End must be after a valid start",
    );
    expect(screen.getByRole("button", { name: "Save edits" })).toBeDisabled();
  });
});
