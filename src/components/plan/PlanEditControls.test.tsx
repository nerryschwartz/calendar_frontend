import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  draftPlanRef,
  persistedPlanRef,
  templatePlanRef,
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
  it("queues first-instance and whole-series windows on distinct targets", () => {
    const queueEdit = vi.fn();
    render(
      <MemoryRouter>
        <PlanEditControls
          plan={planDetail()}
          draftEdits={[]}
          queueEdit={queueEdit}
        />
      </MemoryRouter>,
    );
    const form = within(screen.getByRole("group", { name: "Create child" }));
    fireEvent.change(form.getByLabelText("Kind"), {
      target: { value: "REPETITION" },
    });
    fireEvent.change(form.getByLabelText("Name"), {
      target: { value: "Lunch" },
    });
    for (const prefix of ["First instance", "Whole-series"]) {
      fireEvent.change(form.getByLabelText(prefix + " constraint start"), {
        target: { value: "2026-09-12T11:00" },
      });
      fireEvent.change(form.getByLabelText(prefix + " constraint end"), {
        target: { value: "2026-09-12T15:00" },
      });
    }
    fireEvent.click(form.getByText("Queue create child"));
    const ref = draftPlanRef(queueEdit.mock.calls[0][0].draftId);
    expect(queueEdit.mock.calls[1][0].planRef).toEqual(ref);
    expect(queueEdit.mock.calls[2][0].planRef).toEqual(templatePlanRef(ref));
  });
  it("queues persisted repetition settings without immediate API mutation", async () => {
    const user = userEvent.setup();
    const queueEdit = vi.fn();
    const plan = {
      ...planDetail(),
      plan_kind: "REPETITION" as const,
      repetition_detail: {
        plan_id: "current-plan-id",
        name: "Repeat",
        is_master: false,
        parent_id: "master-plan-id",
        repeat_mode: "MANUAL_COUNT" as const,
        start_time: "2026-09-10T10:00:00Z",
        repeat_interval_minutes: 1440,
        manual_count: 5,
        end_time: null,
        template_root_id: "template",
        default_instance_critical: false,
        generated_at: null,
        created_at: "2026-09-01T10:00:00Z",
        updated_at: "2026-09-01T10:00:00Z",
      },
    };
    render(
      <MemoryRouter>
        <PlanEditControls plan={plan} draftEdits={[]} queueEdit={queueEdit} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Days"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("Hours"), {
      target: { value: "12" },
    });
    await user.click(
      screen.getByRole("button", { name: "Queue repetition settings" }),
    );
    expect(queueEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "repetitionSettings",
        planRef: persistedPlanRef("current-plan-id"),
        body: expect.objectContaining({
          repeat_interval_minutes: 720,
          manual_count: 5,
        }),
      }),
    );
  });
  it("queues a complete task child with families, prerequisite and time constraint then resets the form", async () => {
    const user = userEvent.setup();
    const queueEdit = vi.fn();
    const prerequisite: DraftEdit = {
      type: "createChild",
      draftId: "prerequisite",
      parentRef: persistedPlanRef("current-plan-id"),
      body: { kind: "GOAL", name: "First goal", is_critical: false },
    };
    render(
      <MemoryRouter>
        <PlanEditControls
          plan={planDetail()}
          draftEdits={[prerequisite]}
          queueEdit={queueEdit}
        />
      </MemoryRouter>,
    );
    const form = within(screen.getByRole("group", { name: "Create child" }));
    await user.selectOptions(form.getByLabelText("Kind"), "TASK");
    fireEvent.change(form.getByLabelText("Name"), {
      target: { value: "New task" },
    });
    fireEvent.change(form.getByLabelText("Duration"), {
      target: { value: "45" },
    });
    await user.click(form.getByLabelText("Divisible"));
    fireEvent.change(form.getByLabelText("Min chunk"), {
      target: { value: "15" },
    });
    fireEvent.change(form.getByLabelText("Block families"), {
      target: { value: "focus, home" },
    });
    await user.selectOptions(
      form.getByLabelText("Pending prerequisite"),
      "prerequisite",
    );
    fireEvent.change(form.getByLabelText("Constraint start"), {
      target: { value: "2026-09-10T10:00" },
    });
    fireEvent.change(form.getByLabelText("Constraint end"), {
      target: { value: "2026-09-10T11:00" },
    });
    await user.click(form.getByRole("button", { name: "Queue create child" }));
    const created = queueEdit.mock.calls[0][0];
    expect(created.body).toMatchObject({
      kind: "TASK",
      duration_minutes: 45,
      divisible: true,
      minimum_chunk_size_minutes: 15,
    });
    expect(queueEdit.mock.calls.slice(1).map(([edit]) => edit)).toEqual([
      {
        type: "taskBlockFamilies",
        planRef: draftPlanRef(created.draftId),
        families: ["focus", "home"],
      },
      {
        type: "addPrerequisite",
        planRef: draftPlanRef(created.draftId),
        prerequisitePlanRef: draftPlanRef("prerequisite"),
      },
      expect.objectContaining({
        type: "addConstraintGroup",
        planRef: draftPlanRef(created.draftId),
      }),
    ]);
    expect(form.getByLabelText("Name")).toHaveValue("");
    expect(form.getByLabelText("Kind")).toHaveValue("GOAL");
    expect(form.getByLabelText("Constraint start")).toHaveValue("");
    expect(
      form.queryByText("First goal", { selector: "li" }),
    ).not.toBeInTheDocument();
  });

  it("shows date-range repetition fields and queues the requested range", async () => {
    const user = userEvent.setup();
    const queueEdit = vi.fn();
    render(
      <MemoryRouter>
        <PlanEditControls
          plan={planDetail()}
          draftEdits={[]}
          queueEdit={queueEdit}
        />
      </MemoryRouter>,
    );
    const form = within(screen.getByRole("group", { name: "Create child" }));
    await user.selectOptions(form.getByLabelText("Kind"), "REPETITION");
    expect(form.getByLabelText("Manual count")).toBeVisible();
    await user.selectOptions(form.getByLabelText("Repeat mode"), "DATE_RANGE");
    expect(form.queryByLabelText("Manual count")).not.toBeInTheDocument();
    fireEvent.change(form.getByLabelText("Name"), {
      target: { value: "Daily work" },
    });
    fireEvent.change(form.getByLabelText("Start"), {
      target: { value: "2026-09-10T10:00" },
    });
    fireEvent.change(form.getByLabelText("End"), {
      target: { value: "2026-09-12T10:00" },
    });
    await user.click(form.getByRole("button", { name: "Queue create child" }));
    expect(queueEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          repeat_mode: "DATE_RANGE",
          manual_count: null,
          end_time: new Date("2026-09-12T10:00").toISOString(),
        }),
      }),
    );
  });

  it("edits a pending task and queues additional constraints against its draft ref", async () => {
    const user = userEvent.setup();
    const queueEdit = vi.fn();
    const pending: DraftEdit = {
      type: "createChild",
      draftId: "task",
      parentRef: persistedPlanRef("current-plan-id"),
      body: {
        kind: "TASK",
        name: "Pending task",
        is_critical: false,
        duration_minutes: 30,
      },
    };
    render(
      <MemoryRouter>
        <PlanEditControls
          plan={planDetail()}
          draftEdits={[pending]}
          queueEdit={queueEdit}
        />
      </MemoryRouter>,
    );
    await user.selectOptions(screen.getByLabelText("Edit target"), "task");
    const scheduling = within(
      screen.getByRole("group", { name: "Task scheduling" }),
    );
    fireEvent.change(scheduling.getByLabelText("Duration"), {
      target: { value: "60" },
    });
    await user.click(
      scheduling.getByRole("button", { name: "Queue task scheduling" }),
    );
    expect(queueEdit).toHaveBeenCalledWith({
      type: "taskScheduling",
      planRef: draftPlanRef("task"),
      body: {
        duration_minutes: 60,
        divisible: false,
        minimum_chunk_size_minutes: null,
      },
    });
    fireEvent.change(screen.getByLabelText("Pending constraint start"), {
      target: { value: "2026-09-10T10:00" },
    });
    fireEvent.change(screen.getByLabelText("Pending constraint end"), {
      target: { value: "2026-09-10T11:00" },
    });
    await user.click(
      screen.getByRole("button", { name: "Queue pending constraint" }),
    );
    expect(queueEdit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "addConstraintGroup",
        planRef: draftPlanRef("task"),
      }),
    );
  });

  it("hides invalid child creation for non-GOAL plans", () => {
    render(
      <MemoryRouter>
        <PlanEditControls
          plan={{ ...planDetail(), plan_kind: "TASK" }}
          draftEdits={[]}
          queueEdit={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole("group", { name: "Create child" }),
    ).not.toBeInTheDocument();
  });
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
