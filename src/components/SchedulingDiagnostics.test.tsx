import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import type { AssignmentConflict } from "../api/types";
import ErrorBanner from "./ErrorBanner";
import RefreshResultPanel from "./RefreshResultPanel";

const conflict: AssignmentConflict = {
  conflicting_plan_ids: ["goal"],
  affected_priority_by_plan_id: [["task", 0]],
  reason_code: "NO_VALID_WINDOW_FOR_TASK",
  task_ids: ["task"],
  explanation: "Thing 1 does not fit the effective windows.",
  is_global: false,
  is_approximate: true,
  diagnostics: {
    tasks: [
      {
        plan_id: "task",
        name: "Thing 1",
        duration_minutes: 120,
        divisible: true,
        minimum_chunk_size_minutes: 60,
        allowed_block_families: ["focus"],
      },
    ],
    constraint_sources: [
      {
        plan_id: "goal",
        name: "Two Things",
        constraint_kind: "USER",
        constraint_group_id: "group",
        windows: [
          {
            start_time: "2026-09-17T00:00:00Z",
            end_time: "2026-09-17T03:00:00Z",
          },
        ],
      },
    ],
    effective_windows: [{ plan_id: "task", windows: [] }],
    blocking_plans: [{ plan_id: "blocker", name: "Thing 2" }],
    solver: {
      stage: "model_size",
      estimate: 200,
      limit: 100,
      proof_status: "not_proven",
    },
  },
};
const assignment = {
  run_started_at: "2026-09-16T00:33:00Z",
  optimization_status: "UNKNOWN" as const,
  calendar_entries: [],
  conflicts: [conflict],
  warnings: [
    {
      code: "SOLVER_LIMIT_REACHED",
      message: "Model limit reached",
      details: {},
    },
  ],
  runtime_ms: 10,
  calendar_run_id: null,
};

it("renders named task requirements, timezone, sources, blockers and solver limits for unknown outcomes", () => {
  render(
    <MemoryRouter>
      <ErrorBanner
        detail={{
          errors: [
            {
              code: "NO_VALID_WINDOW_FOR_TASK",
              message: "No window found",
              details: {},
            },
          ],
          value: assignment,
        }}
      />
    </MemoryRouter>,
  );
  expect(screen.getAllByRole("link", { name: "Thing 1" })[0]).toHaveAttribute(
    "href",
    "/plan-tree/task",
  );
  expect(screen.getByRole("link", { name: "Two Things" })).toHaveAttribute(
    "href",
    "/plan-tree/goal",
  );
  expect(screen.getByRole("link", { name: "Thing 2" })).toHaveAttribute(
    "href",
    "/plan-tree/blocker",
  );
  expect(
    screen.getByText(/120 minutes; divisible, minimum chunk 60/),
  ).toBeVisible();
  expect(screen.getByText(/Timezone:/)).toHaveTextContent(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  expect(screen.getByText("No available interval.")).toBeVisible();
  expect(screen.getByText(/estimate: 200; limit: 100/)).toBeVisible();
  expect(screen.getByText(/previous calendar remains unchanged/)).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Get conflict suggestions" }),
  ).not.toBeInTheDocument();
});

it("renders nested refresh diagnostics and proven failures without requiring the new optional field", () => {
  const { rerender } = render(
    <MemoryRouter>
      <ErrorBanner detail={{ errors: [], value: { assignment } }} />
    </MemoryRouter>,
  );
  expect(
    screen.getByText("Thing 1 does not fit the effective windows."),
  ).toBeVisible();
  rerender(
    <MemoryRouter>
      <RefreshResultPanel
        result={{
          run_started_at: assignment.run_started_at,
          assignment: {
            ...assignment,
            optimization_status: "INFEASIBLE",
            conflicts: [{ ...conflict, diagnostics: undefined }],
          },
          block_assignment: null,
          resolved: null,
          resolved_blocks: null,
          free_time: null,
        }}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText(/No feasible calendar/)).toBeVisible();
  expect(screen.getByRole("link", { name: "task" })).toHaveAttribute(
    "href",
    "/plan-tree/task",
  );
});
