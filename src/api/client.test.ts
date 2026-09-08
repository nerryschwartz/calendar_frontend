import { afterEach, describe, expect, it, vi } from "vitest";
import { apiGet } from "./client";
import { ApiError } from "./types";

afterEach(() => vi.unstubAllGlobals());
describe("API error responses", () => {
  it("normalizes FastAPI validation locations and messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              detail: [
                {
                  loc: ["body", "duration_minutes"],
                  msg: "Input should be a valid integer",
                  type: "int_parsing",
                },
              ],
            }),
            { status: 422 },
          ),
        ),
    );
    await expect(apiGet("/test")).rejects.toMatchObject({
      detail: {
        errors: [
          {
            code: "int_parsing",
            message: "body.duration_minutes: Input should be a valid integer",
          },
        ],
      },
    });
  });
  it.each([
    { detail: "Invalid UUID" },
    { detail: null },
    { detail: { unexpected: true } },
  ])("handles other HTTP error shapes", async (body) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(body), {
            status: 400,
            statusText: "Bad Request",
          }),
        ),
    );
    await expect(apiGet("/test")).rejects.toBeInstanceOf(ApiError);
  });
  it("preserves structured application errors and their value", async () => {
    const detail = {
      errors: [{ code: "CONFLICT", message: "Invalid window", details: {} }],
      value: { conflicts: [] },
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail }), { status: 409 }),
        ),
    );
    await expect(apiGet("/test")).rejects.toMatchObject({ detail });
  });
});
