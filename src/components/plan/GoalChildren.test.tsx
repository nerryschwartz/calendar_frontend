import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { persistedPlanRef } from "../../api/types";
import { planDetail } from "../../test/plan";
import GoalChildren from "./GoalChildren";

const plan = planDetail({
  children: [
    {
      plan_id: "alpha",
      name: "Alpha",
      plan_kind: "GOAL",
      goal_is_critical: false,
      goal_sort_order: 0,
    },
    {
      plan_id: "beta",
      name: "Beta",
      plan_kind: "GOAL",
      goal_is_critical: false,
      goal_sort_order: 1,
    },
  ],
});

it("queues accessible parent-owned order and criticality changes", async () => {
  const queueEdit = vi.fn();
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <GoalChildren plan={plan} edits={[]} editMode queueEdit={queueEdit} />
    </MemoryRouter>,
  );

  await user.click(screen.getByRole("button", { name: "Move Beta up" }));
  expect(queueEdit).toHaveBeenLastCalledWith(
    expect.objectContaining({
      type: "reorderChildren",
      nonCriticalRefs: [persistedPlanRef("beta"), persistedPlanRef("alpha")],
    }),
  );

  await user.click(
    screen.getByRole("button", {
      name: "Move Beta to critical children",
    }),
  );
  expect(queueEdit).toHaveBeenLastCalledWith(
    expect.objectContaining({
      criticalRefs: [persistedPlanRef("beta")],
      nonCriticalRefs: [persistedPlanRef("alpha")],
    }),
  );
});
