import { useState } from "react";
import { Link } from "react-router-dom";
import { getConflictSuggestions } from "../api/deletion";
import {
  getAssignmentConflicts,
  isApiError,
  type ApiErrorDetail,
  type AssignmentConflict,
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
      {conflicts.length > 0 && (
        <div className="conflicts">
          <strong>Assignment conflicts</strong>
          <ul>
            {conflicts.map((conflict, index) => (
              <li key={index}>
                <ConflictItem conflict={conflict} />
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  disabled={suggestionsLoading}
                  onClick={() => void loadSuggestions(conflict)}
                >
                  Get conflict suggestions
                </button>
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

function ConflictItem({ conflict }: { conflict: AssignmentConflict }) {
  return (
    <div>
      <p>{conflict.explanation || "Scheduling conflict"}</p>
      {conflict.reason_code && (
        <p className="muted">
          Reason: <code>{conflict.reason_code}</code>
          {conflict.is_global && " · global"}
          {conflict.is_approximate && " · approximate"}
        </p>
      )}
      {conflict.conflicting_plan_ids.length > 0 && (
        <p>
          Plans:{" "}
          {conflict.conflicting_plan_ids.map((id, i) => (
            <span key={id}>
              {i > 0 && ", "}
              <Link to={`/plan-tree/${id}`}>{id}</Link>
            </span>
          ))}
        </p>
      )}
      {conflict.task_ids.length > 0 && (
        <p className="muted">Tasks: {conflict.task_ids.join(", ")}</p>
      )}
      {conflict.affected_priority_by_plan_id.length > 0 && (
        <p className="muted">
          Priorities:{" "}
          {conflict.affected_priority_by_plan_id
            .map(([id, p]) => `${id}=${p}`)
            .join(", ")}
        </p>
      )}
    </div>
  );
}
