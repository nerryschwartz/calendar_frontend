import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import PlanConstraintsPanel from "./PlanConstraintsPanel";
import { planDetail } from "../../test/plan";
import { draftPlanRef, type DraftEdit } from "../../api/types";

const windows = [
  {
    time_window_id: "first",
    start_time: "2026-09-12T17:00:00Z",
    end_time: "2026-09-12T20:00:00Z",
  },
  {
    time_window_id: "second",
    start_time: "2026-09-13T17:00:00Z",
    end_time: "2026-09-13T20:00:00Z",
  },
];
const plan = planDetail({
  plan_id: "template",
  is_master: false,
  time_constraint_groups: [
    {
      constraint_group_id: "group",
      plan_id: "template",
      constraint_kind: "USER",
      windows,
    },
  ],
});
it("prefills the existing window editor and preserves other windows with blank new inputs", () => {
  const queueEdit = vi.fn();
  render(
    <PlanConstraintsPanel
      plan={plan}
      editMode
      draftEdits={[]}
      queueEdit={queueEdit}
      title="First instance time constraints"
    />,
  );
  const group = within(
    screen.getByRole("group", { name: "Time constraint group group" }),
  );
  expect(group.getAllByLabelText("Start")[0]).not.toHaveValue("");
  const field = group.getAllByLabelText("End")[0] as HTMLInputElement;
  const original = field.value;
  fireEvent.change(field, {
    target: { value: original.replace(":00", ":30") },
  });
  fireEvent.click(group.getByText("Queue window changes"));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(queueEdit.mock.calls[0][0]).toMatchObject({
    type: "replaceConstraintWindows",
    groupId: "group",
    body: {
      windows: [
        { start_time: new Date(windows[0].start_time).toISOString() },
        {
          start_time: new Date(windows[1].start_time).toISOString(),
          end_time: new Date(windows[1].end_time).toISOString(),
        },
      ],
    },
  });
});
it("shows field-specific new-window errors and clears them after correction", () => {
  const queueEdit = vi.fn();
  render(
    <PlanConstraintsPanel
      plan={plan}
      editMode
      draftEdits={[]}
      queueEdit={queueEdit}
    />,
  );
  const form = within(screen.getByRole("group", { name: "New time window" }));
  fireEvent.click(form.getByText("Queue add group"));
  expect(form.getByText("Enter a valid start time.")).toBeVisible();
  expect(form.getByText("Enter a valid end time.")).toBeVisible();
  fireEvent.change(form.getByLabelText("Start"), {
    target: { value: "2026-09-12T15:00" },
  });
  fireEvent.change(form.getByLabelText("End"), {
    target: { value: "2026-09-12T12:00" },
  });
  expect(
    form.getByText("End must be after Start for this window."),
  ).toBeVisible();
  fireEvent.change(form.getByLabelText("End"), {
    target: { value: "2026-09-12T16:00" },
  });
  expect(form.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(form.getByText("Queue add group"));
  expect(queueEdit).toHaveBeenCalledOnce();
  expect(form.getByLabelText("Start")).toHaveValue("");
});
it("edits and removes a pending group using the same prefilled editor", () => {
  const ref = draftPlanRef("pending");
  function Harness() {
    const [edits, setEdits] = useState<DraftEdit[]>([
      {
        type: "addConstraintGroup",
        planRef: ref,
        groupId: "pending-group",
        body: { windows },
      },
    ]);
    return (
      <PlanConstraintsPanel
        plan={planDetail({ is_master: false })}
        targetRef={ref}
        editMode
        draftEdits={edits}
        queueEdit={(edit) => setEdits((previous) => [...previous, edit])}
      />
    );
  }
  render(<Harness />);
  const group = within(
    screen.getByRole("group", { name: "Time constraint group pending-group" }),
  );
  fireEvent.click(group.getAllByText("Queue remove window")[0]);
  expect(group.getAllByLabelText("Start")).toHaveLength(1);
  fireEvent.click(group.getByText("Queue remove group"));
  expect(
    screen.queryByRole("group", {
      name: "Time constraint group pending-group",
    }),
  ).not.toBeInTheDocument();
});
