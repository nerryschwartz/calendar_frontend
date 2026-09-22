import { useState } from "react";
import SchedulingDiagnostics, { SolverOutcome } from "./SchedulingDiagnostics";
import { getConflictSuggestions } from "../api/deletion";
import {
  getAssignmentConflicts,
  isApiError,
  type ApiErrorDetail,
  type AssignmentConflict,
  type AssignmentResult,
  type RefreshScheduleResult,
} from "../api/types";

interface ErrorBannerProps {
  detail: ApiErrorDetail | null;
  onDismiss?: () => void;
}

export default function ErrorBanner({ detail, onDismiss }: ErrorBannerProps) {
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  if (!detail) return null;

  const conflicts = getAssignmentConflicts(detail);
  const value = detail.value as
    Partial<AssignmentResult & RefreshScheduleResult> | undefined;
  const stages =
    value && typeof value === "object"
      ? [value, value.assignment, value.block_assignment].filter(
          (stage) => stage?.optimization_status,
        )
      : [];

  const loadSuggestions = async (conflict: AssignmentConflict) => {
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    setSuggestions([]);
    try {
      const result = await getConflictSuggestions(conflict);
      setSuggestions(result.suggestions.map((s) => s.explanation));
    } catch (err) {
      setSuggestionsError(
        isApiError(err) ? err.message : "Failed to load suggestions",
      );
    } finally {
      setSuggestionsLoading(false);
    }
  };

  return (
    <div className="error-banner" role="alert">
      <div className="error-banner-header">
        <strong>Errors</strong>
        {onDismiss && (
          <button type="button" className="btn-text" onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>
      <ul>
        {detail.errors.map((error, index) => (
          <li key={`${error.code}-${index}`}>
            <code>{error.code}</code> — {error.message}
            {Object.keys(error.details).length > 0 && (
              <ul className="error-details">
                {Object.entries(error.details).map(([key, value]) => (
                  <li key={key}>
                    {key}: {value}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {stages.map((stage, index) => (
        <div key={index}>
          <SolverOutcome status={stage!.optimization_status!} />
          {!!stage!.warnings?.length && (
            <ul>
              {stage!.warnings.map((warning, index) => (
                <li key={index}>
                  <code>{warning.code}</code>: {warning.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {conflicts.length > 0 && (
        <div className="conflicts">
          <strong>Assignment conflicts</strong>
          <ul>
            {conflicts.map((conflict, index) => (
              <li key={index}>
                <SchedulingDiagnostics conflict={conflict} />
                {conflict.diagnostics?.solver.proof_status !== "not_proven" && (
                  <button
                    type="button"
                    className="btn-secondary btn-small"
                    disabled={suggestionsLoading}
                    onClick={() => void loadSuggestions(conflict)}
                  >
                    Get conflict suggestions
                  </button>
                )}
              </li>
            ))}
          </ul>
          {suggestionsError && <p className="error-text">{suggestionsError}</p>}
          {suggestions.length > 0 && (
            <ul>
              {suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
