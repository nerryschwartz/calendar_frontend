import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import {
  persistedPlanRef,
  type DraftEdit,
  type PlanDetailDTO,
} from "../api/types";
import PlanDraftProvider from "../components/PlanDraftProvider";
import PlanEditControls from "../components/plan/PlanEditControls";
import { usePlanEditMode } from "../hooks/usePlanEditMode";
import { planDetail } from "../test/plan";

const repeat = (generated = false): PlanDetailDTO =>
  planDetail({
    plan_id: "repeat",
    name: "Lunch",
    plan_kind: "REPETITION",
    repetition_detail: {
      plan_id: "repeat",
      name: "Lunch",
      is_master: false,
      parent_id: "master",
      repeat_mode: "MANUAL_COUNT",
      start_time: "2026-09-12T05:00:00Z",
      repeat_interval_minutes: 1440,
      manual_count: 14,
      end_time: null,
      template_root_id: "template",
      default_instance_critical: false,
      generated_at: generated ? "2026-09-12T00:00:00Z" : null,
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    },
  });
const template = planDetail({
  plan_id: "template",
  name: "Lunch template",
  plan_kind: "TASK",
  task_detail: {
    plan_id: "template",
    name: "Lunch template",
    is_master: false,
    parent_id: "repeat",
    duration_minutes: 30,
    divisible: false,
    minimum_chunk_size_minutes: null,
    user_completed: false,
    completed_at: null,
    allowed_block_families: [],
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  },
});
beforeEach(() => vi.restoreAllMocks());

it("keeps generated count and critical controls editable while locking cadence", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(template))),
  );
  const queueEdit = vi.fn();
  render(
    <MemoryRouter>
      <PlanEditControls
        plan={repeat(true)}
        draftEdits={[]}
        queueEdit={queueEdit}
      />
    </MemoryRouter>,
  );
  expect(screen.getByLabelText("Repeat mode")).toBeDisabled();
  expect(screen.getByLabelText("Start")).toBeDisabled();
  expect(screen.getByLabelText("Days")).toBeDisabled();
  expect(screen.getByLabelText("Manual count")).toBeEnabled();
  expect(screen.getByLabelText("Default instance critical")).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Manual count"), {
    target: { value: "15" },
  });
  fireEvent.click(screen.getByText("Queue repetition settings"));
  const edit = queueEdit.mock.calls[0][0];
  expect(edit.body.manual_count).toBe(15);
  expect(edit.body).not.toHaveProperty("start_time");
  expect(edit.body).not.toHaveProperty("repeat_interval_minutes");
  expect(edit.body).not.toHaveProperty("repeat_mode");
});

it("keeps generated date-range end extension editable", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(template))),
  );
  const plan = repeat(true);
  plan.repetition_detail!.repeat_mode = "DATE_RANGE";
  plan.repetition_detail!.end_time = "2026-09-26T05:00:00Z";
  const queueEdit = vi.fn();
  render(
    <MemoryRouter>
      <PlanEditControls plan={plan} draftEdits={[]} queueEdit={queueEdit} />
    </MemoryRouter>,
  );
  expect(screen.getByLabelText("End")).toBeEnabled();
  fireEvent.change(screen.getByLabelText("End"), {
    target: { value: "2026-09-27T00:00" },
  });
  fireEvent.click(screen.getByText("Queue repetition settings"));
  expect(queueEdit.mock.calls[0][0].body.end_time).toBe(
    new Date("2026-09-27T00:00").toISOString(),
  );
});

it("captures current template fields once and does not replay them after uncertain generation", async () => {
  let generated = false;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/generate-instances")) {
      generated = true;
      throw new Error("Lost response");
    }
    const body = url.endsWith("/repeat")
      ? repeat(generated)
      : url.endsWith("/template")
        ? template
        : url.endsWith("/generation-status")
          ? {
              repetitions: [
                {
                  plan_id: "repeat",
                  name: "Lunch",
                  template_root_id: "template",
                  generated_at: generated ? "now" : null,
                  instance_count: generated ? 14 : 0,
                },
              ],
            }
          : {};
    return new Response(JSON.stringify(body));
  });
  vi.stubGlobal("fetch", fetchMock);
  function Harness() {
    const editing = usePlanEditMode();
    return (
      <>
        <PlanEditControls
          plan={repeat()}
          draftEdits={editing.draftEdits}
          queueEdit={editing.queueEdit}
        />
        <button
          disabled={editing.saving}
          onClick={() =>
            void editing.generateInstances(persistedPlanRef("repeat"))
          }
        >
          Generate test
        </button>
        <p>{editing.successMessage}</p>
      </>
    );
  }
  const { rerender } = render(
    <MemoryRouter>
      <PlanDraftProvider>
        <Harness key="initial-route" />
      </PlanDraftProvider>
    </MemoryRouter>,
  );
  await screen.findByRole("heading", {
    name: "First instance time constraints",
  });
  const editor = within(
    screen.getByRole("group", { name: "First instance template" }),
  );
  fireEvent.change(editor.getByLabelText("Duration"), {
    target: { value: "45" },
  });
  fireEvent.change(editor.getByLabelText("Start"), {
    target: { value: "2026-09-12T11:00" },
  });
  fireEvent.change(editor.getByLabelText("End"), {
    target: { value: "2026-09-12T15:00" },
  });
  fireEvent.click(screen.getByText("Generate test"));
  await waitFor(() => expect(screen.getByText("Generate test")).toBeEnabled());
  expect(editor.getByLabelText("Start")).toHaveValue("");
  expect(screen.getByText(/Generated 14/)).toBeVisible();
  rerender(
    <MemoryRouter>
      <PlanDraftProvider>
        <Harness key="detail-route" />
      </PlanDraftProvider>
    </MemoryRouter>,
  );
  expect(screen.getByText(/Generated 14/)).toBeVisible();
  fireEvent.click(screen.getByText("Generate test"));
  await waitFor(() => expect(screen.getByText("Generate test")).toBeEnabled());
  expect(
    fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/generate-instances"),
    ),
  ).toHaveLength(1);
  expect(
    fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/constraints/groups"),
    ),
  ).toHaveLength(1);
  expect(
    fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/task/scheduling"),
    ),
  ).toHaveLength(1);
});

it("passes a complete new repetition to immediate generation instead of a separate Save", () => {
  const generate = vi.fn(async (_ref, _edits: DraftEdit[]) => "created");
  const queueEdit = vi.fn();
  render(
    <MemoryRouter>
      <PlanEditControls
        plan={planDetail()}
        draftEdits={[]}
        queueEdit={queueEdit}
        onGenerate={generate}
      />
    </MemoryRouter>,
  );
  const form = within(screen.getByRole("group", { name: "Create child" }));
  fireEvent.change(form.getByLabelText("Kind"), {
    target: { value: "REPETITION" },
  });
  fireEvent.change(form.getByLabelText("Name"), { target: { value: "Lunch" } });
  fireEvent.change(form.getByLabelText("First instance constraint start"), {
    target: { value: "2026-09-12T11:00" },
  });
  fireEvent.change(form.getByLabelText("First instance constraint end"), {
    target: { value: "2026-09-12T15:00" },
  });
  fireEvent.click(form.getByText("Generate instances"));
  expect(queueEdit).not.toHaveBeenCalled();
  expect(generate.mock.calls[0][1]).toHaveLength(2);
  expect(form.getByLabelText("Name")).toHaveValue("");
});
