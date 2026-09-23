import { beforeEach, expect, it, vi } from "vitest";
import { applyDraftEdits, DraftEditApplyError } from "./plans";
import { repetitionReadiness } from "./repetitionReadiness";
import {
  draftPlanRef,
  persistedPlanRef,
  templatePlanRef,
  type DraftEdit,
} from "./types";
import {
  generationBaseline,
  generationInput,
  generationIsFresh,
} from "../utils/generationInput";
import { mockGenerationPreview, repetitionCreate } from "../test/repetition";
import type { GenerationEdit } from "../utils/generatedPlans";

beforeEach(() => vi.restoreAllMocks());
async function setup() {
  const edits: DraftEdit[] = [
    repetitionCreate,
    {
      type: "taskScheduling",
      planRef: templatePlanRef(draftPlanRef("repeat")),
      body: { duration_minutes: 45 },
    },
  ];
  const { baseline, sourceRefs } = await generationBaseline(
    draftPlanRef("repeat"),
    edits,
  );
  const batch: GenerationEdit = {
    type: "generateInstances",
    planRef: draftPlanRef("repeat"),
    baseline,
    sourceRefs,
    preview: mockGenerationPreview(
      generationInput(baseline, sourceRefs, edits),
    ),
  };
  return { edits, batch };
}
function backend(failure: "none" | "generation" | "rename" = "none") {
  let fail = failure;
  const fetchMock = vi.fn(
    async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      if (path.endsWith("/generation-status"))
        return new Response(JSON.stringify({ repetitions: [] }));
      if (path.endsWith("/children"))
        return new Response(JSON.stringify({ plan_id: "saved-repeat" }));
      if (path.endsWith("/saved-repeat"))
        return new Response(
          JSON.stringify({
            repetition_detail: { template_root_id: "saved-template" },
            ancestry: [],
          }),
        );
      if (path.endsWith("/commit-generation")) {
        if (fail === "generation") {
          fail = "none";
          throw new Error("Lost generation response");
        }
        const { preview } = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            repetition: {},
            reference_map: {
              plans: Object.fromEntries(
                preview.instances.flatMap(
                  (instance: { nodes: { ref: string }[] }) =>
                    instance.nodes.map((node) => [
                      node.ref,
                      "saved-" + node.ref,
                    ]),
                ),
              ),
              groups: {},
              windows: {},
            },
          }),
        );
      }
      if (path.endsWith("/rename") && fail === "rename") {
        fail = "none";
        throw new Error("Rename offline");
      }
      return new Response(JSON.stringify({ ancestry: [], children: [] }));
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
it("commits generation after template edits and before instance edits, without ordinary instance creates", async () => {
  const { edits, batch } = await setup();
  const fetchMock = backend();
  await applyDraftEdits([
    edits[0],
    batch,
    edits[1],
    {
      type: "rename",
      planRef: draftPlanRef(batch.preview.instances[0].root_ref),
      name: "Customized",
    },
  ]);
  const paths = fetchMock.mock.calls.map(([url]) => String(url));
  expect(paths.filter((path) => path.endsWith("/children"))).toHaveLength(1);
  expect(
    paths.findIndex((path) => path.endsWith("/task/scheduling")),
  ).toBeLessThan(
    paths.findIndex((path) => path.endsWith("/commit-generation")),
  );
  expect(paths.at(-1)).toContain("/saved-generation-0-");
});
it("retains the identical preview and resolved input IDs after an uncertain commit", async () => {
  const { edits, batch } = await setup();
  const fetchMock = backend("generation");
  let error: DraftEditApplyError | undefined;
  try {
    await applyDraftEdits([...edits, batch]);
  } catch (err) {
    error = err as DraftEditApplyError;
  }
  const remaining = error!.remainingEdits!;
  expect(remaining).toHaveLength(1);
  const retry = remaining[0] as GenerationEdit;
  expect(retry.planRef).toEqual(persistedPlanRef("saved-repeat"));
  expect(generationIsFresh(retry, remaining)).toBe(true);
  await applyDraftEdits(remaining);
  const commits = fetchMock.mock.calls.filter(([url]) =>
    String(url).endsWith("/commit-generation"),
  );
  expect(commits).toHaveLength(2);
  expect(commits[1][1]?.body).toBe(commits[0][1]?.body);
  expect(
    fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/children")),
  ).toHaveLength(1);
});
it("does not replay generation when a later instance edit fails", async () => {
  const { edits, batch } = await setup();
  const fetchMock = backend("rename");
  let error: DraftEditApplyError | undefined;
  try {
    await applyDraftEdits([
      ...edits,
      batch,
      {
        type: "rename",
        planRef: draftPlanRef(batch.preview.instances[0].root_ref),
        name: "Custom",
      },
    ]);
  } catch (err) {
    error = err as DraftEditApplyError;
  }
  expect(error!.remainingEdits!).toMatchObject([
    { type: "rename", planRef: { kind: "persisted" } },
  ]);
  await applyDraftEdits(error!.remainingEdits!);
  expect(
    fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/commit-generation"),
    ),
  ).toHaveLength(1);
});
it("readiness accepts fresh previews and records deleted instance roots as omissions", async () => {
  const { edits, batch } = await setup();
  backend();
  const deletion: DraftEdit = {
    type: "delete",
    planRef: draftPlanRef(batch.preview.instances[0].root_ref),
  };
  const result = await repetitionReadiness([...edits, batch, deletion]);
  expect(result.blockers).toEqual([]);
  expect(result.effectiveEdits.at(-1)).toMatchObject({
    type: "generateInstances",
    omittedIndices: [0],
  });
  const stale = await repetitionReadiness([
    ...edits,
    batch,
    {
      type: "repetitionSettings",
      planRef: draftPlanRef("repeat"),
      body: { manual_count: 3 },
    },
  ]);
  expect(stale.blockers).toHaveLength(1);
});

it("resolves nested template children and retries parent ordering without replaying creation", async () => {
  let failOrder = true;
  const fetchMock = vi.fn(
    async (url: RequestInfo | URL, _init?: RequestInit) => {
      const path = String(url);
      if (path.endsWith("/master/children"))
        return new Response(JSON.stringify({ plan_id: "outer" }));
      if (path.endsWith("/outer"))
        return new Response(
          JSON.stringify({ repetition_detail: { template_root_id: "inner" } }),
        );
      if (path.endsWith("/inner"))
        return new Response(
          JSON.stringify({ repetition_detail: { template_root_id: "goal" } }),
        );
      if (path.endsWith("/goal/children"))
        return new Response(JSON.stringify({ plan_id: "child" }));
      if (path.endsWith("/children/order") && failOrder) {
        failOrder = false;
        throw new Error("Ordering offline");
      }
      return new Response(JSON.stringify({}));
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  const goal = templatePlanRef(templatePlanRef(draftPlanRef("repeat")));
  const order: DraftEdit = {
    type: "reorderChildren",
    planRef: goal,
    criticalRefs: [draftPlanRef("child")],
    nonCriticalRefs: [],
    previousChildRefs: [],
  };
  let remaining: DraftEdit[] = [];
  try {
    await applyDraftEdits([
      order,
      { ...repetitionCreate, parentRef: persistedPlanRef("master") },
      {
        type: "createChild",
        draftId: "child",
        parentRef: goal,
        body: { kind: "TASK", name: "Child", is_critical: false },
      },
    ]);
  } catch (error) {
    remaining = (error as DraftEditApplyError).remainingEdits!;
  }
  expect(remaining).toMatchObject([
    {
      type: "reorderChildren",
      planRef: persistedPlanRef("goal"),
      criticalRefs: [persistedPlanRef("child")],
    },
  ]);
  await applyDraftEdits(remaining);
  expect(
    fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/children")),
  ).toHaveLength(2);
  expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toEqual({
    critical_child_ids: ["child"],
    non_critical_child_ids: [],
  });
});
