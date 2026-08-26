import { act, render, screen, waitFor } from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getMasterPlan,
  getPlanDeletePreview,
  getPlanDetail,
} from "../api/plans";
import type { PlanDetailDTO } from "../api/types";
import { usePlanEditMode } from "../hooks/usePlanEditMode";
import PlanTreeView from "./PlanTreeView";

vi.mock("../api/plans", () => ({
  getMasterPlan: vi.fn(),
  getPlanDeletePreview: vi.fn(),
  getPlanDetail: vi.fn(),
}));

vi.mock("../hooks/usePlanEditMode", () => ({
  usePlanEditMode: vi.fn(),
}));

const getPlanDetailMock = vi.mocked(getPlanDetail);
const getMasterPlanMock = vi.mocked(getMasterPlan);
const getPlanDeletePreviewMock = vi.mocked(getPlanDeletePreview);
const usePlanEditModeMock = vi.mocked(usePlanEditMode);

function planDetail(overrides: Partial<PlanDetailDTO> = {}): PlanDetailDTO {
  return {
    plan_id: "current-plan-id",
    name: "Current plan",
    plan_kind: "GOAL",
    is_master: false,
    parent_id: "parent-plan-id",
    goal_is_critical: true,
    goal_sort_order: 1,
    created_at: "2026-08-23T17:00:00.000Z",
    updated_at: "2026-08-23T17:00:00.000Z",
    ancestry: [
      {
        plan_id: "parent-plan-id",
        name: "Parent plan",
        plan_kind: "GOAL",
      },
    ],
    children: [],
    prerequisite_plan_ids: [],
    prerequisites: [],
    time_constraint_groups: [],
    goal_detail: null,
    task_detail: null,
    block_detail: null,
    repetition_detail: null,
    ...overrides,
  };
}

function PlanTreeDetailRoute() {
  const { planId } = useParams();
  return <PlanTreeView planId={planId} />;
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("PlanTreeView delete save navigation", () => {
  let onSaved: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    onSaved = undefined;
    getPlanDetailMock.mockImplementation(async (planId) =>
      planId === "parent-plan-id"
        ? planDetail({
            plan_id: "parent-plan-id",
            name: "Parent plan",
            parent_id: null,
            ancestry: [],
          })
        : planDetail(),
    );
    getMasterPlanMock.mockResolvedValue({
      master_plan_id: "master-plan-id",
      plan: planDetail({ plan_id: "master-plan-id", is_master: true }),
    });
    getPlanDeletePreviewMock.mockResolvedValue({
      root_plan_id: "current-plan-id",
      affected_plan_ids: ["current-plan-id"],
      affected_task_ids: [],
      affected_block_ids: [],
      affected_calendar_entry_ids: [],
      affected_block_calendar_entry_ids: [],
      affected_depth_counts_from_master: [],
      warnings: [],
    });
    usePlanEditModeMock.mockImplementation((options = {}) => {
      onSaved = options.onSaved;
      return {
        editMode: true,
        draftEdits: [{ type: "delete", planId: "current-plan-id" }],
        saving: false,
        refreshingSchedule: false,
        error: null,
        successMessage: null,
        refreshResult: null,
        confirmExit: false,
        queueEdit: vi.fn(),
        removeDraft: vi.fn(),
        enterEditMode: vi.fn(),
        requestExitEditMode: vi.fn(),
        discardAndExit: vi.fn(),
        saveEdits: vi.fn(),
        cancelExit: vi.fn(),
        setError: vi.fn(),
        setSuccessMessage: vi.fn(),
      };
    });
  });

  it("navigates to the parent route instead of reloading the deleted detail", async () => {
    render(
      <MemoryRouter initialEntries={["/plan-tree/current-plan-id"]}>
        <Routes>
          <Route
            path="/plan-tree"
            element={
              <>
                <PlanTreeView />
                <LocationProbe />
              </>
            }
          />
          <Route
            path="/plan-tree/:planId"
            element={
              <>
                <PlanTreeDetailRoute />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Current plan" });

    act(() => {
      onSaved?.();
    });

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/plan-tree/parent-plan-id",
      );
    });
    expect(getPlanDetailMock).toHaveBeenCalledWith("current-plan-id");
    expect(getPlanDetailMock).not.toHaveBeenNthCalledWith(2, "current-plan-id");
  });
});
