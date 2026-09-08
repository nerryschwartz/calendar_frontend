import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchPlans } from "../api/plans";
import type { PlanSearchResultDTO } from "../api/types";
import LabeledField from "./LabeledField";

interface PlanSearchInputProps {
  placeholder?: string;
  label?: string;
  onSelect?: (result: PlanSearchResultDTO) => void;
}

export default function PlanSearchInput({
  placeholder = "Search plans…",
  label = "Search plans",
  onSelect,
}: PlanSearchInputProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlanSearchResultDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setError(null);
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const handle = window.setTimeout(() => {
      setLoading(true);
      void searchPlans(query.trim())
        .then((data) => {
          if (current) setResults(data.results);
        })
        .catch(() => {
          if (current) {
            setResults([]);
            setError("Plan search failed.");
          }
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 300);
    return () => {
      current = false;
      window.clearTimeout(handle);
    };
  }, [query]);

  const handleSelect = (result: PlanSearchResultDTO) => {
    if (onSelect) {
      onSelect(result);
    } else {
      void navigate(`/plan-tree/${result.plan_id}`);
    }
    setQuery("");
    setResults([]);
  };

  return (
    <div className="plan-search">
      <LabeledField label={label}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
        />
      </LabeledField>
      {error && (
        <span role="alert" className="error-text">
          {error}
        </span>
      )}
      {loading && <span className="muted plan-search-status">Searching…</span>}
      {results.length > 0 && (
        <ul className="plan-search-results">
          {results.map((result) => (
            <li key={result.plan_id}>
              <button type="button" onClick={() => handleSelect(result)}>
                {result.name}{" "}
                <span className="muted">({result.plan_kind})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
