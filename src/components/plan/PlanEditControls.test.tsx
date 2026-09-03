import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  draftPlanRef,
  persistedPlanRef,
  type DraftEdit,
  type PlanDetailDTO,
} from "../../api/types";
import PlanEditControls from "./PlanEditControls";

function planDetail(): PlanDetailDTO {
  return {
    plan_id: "current-plan-id",
    name: "Current plan",
    plan_kind: "GOAL",
    is_master: false,
    parent_id: "master-plan-id",
    goal_is_critical: false,
    goal_sort_order: 0,
    created_at: "2026-08-23T17:00:00.000Z",
    updated_at: "2026-08-23T17:00:00.000Z",
    ancestry: [],
    children: [],
    prerequisite_plan_ids: [],
    prerequisites: [],
    time_constraint_groups: [],
    goal_detail: null,
    task_detail: null,
    block_detail: null,
    repetition_detail: null,
  };
}

describe("PlanEditControls", () => {
  it("[slow] can queue a child under a pending child create", async () => {
    const user = userEvent.setup();
    const queueEdit = vi.fn();
    const pendingParent: DraftEdit = {
      type: "createChild",
      draftId: "draft-parent",
      parentRef: persistedPlanRef("current-plan-id"),
      body: {
        kind: "GOAL",
        is_critical: false,
        name: "Pending parent",
      },
    };

    render(
      <MemoryRouter>
        <PlanEditControls
          plan={planDetail()}
          draftEdits={[pendingParent]}
          queueEdit={queueEdit}
        />
      </MemoryRouter>,
    );

    await user.selectOptions(screen.getByLabelText("Parent"), [
      "draft:draft-parent",
    ]);
    await user.type(screen.getAllByLabelText("Name")[1], "Nested child");
    await user.click(
      screen.getByRole("button", { name: "Queue create child" }),
    );

    expect(queueEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "createChild",
        parentRef: draftPlanRef("draft-parent"),
        body: expect.objectContaining({
          kind: "GOAL",
          name: "Nested child",
        }),
      }),
    );
  });
});
