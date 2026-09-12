import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { PlanDetailSections } from "./PlanRepetitionPanel";
import { planDetail } from "../../test/plan";

it("shows saved instance provenance and detached linkage", () => {
  render(
    <MemoryRouter>
      <PlanDetailSections
        plan={planDetail({
          clone_status: "DETACHED",
          cloned_from_id: "source-template",
          repetition_instance: {
            repetition_plan_id: "repetition",
            instance_index: 2,
            is_critical: false,
            sort_order: 1,
          },
        })}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText("Detached")).toBeVisible();
  expect(screen.getByRole("link", { name: "source-template" })).toHaveAttribute(
    "href",
    "/plan-tree/source-template",
  );
  expect(screen.getByText("Repetition instance")).toBeVisible();
  expect(screen.getByText("3")).toBeVisible();
});
