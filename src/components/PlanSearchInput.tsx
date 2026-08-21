import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchPlans } from "../api/plans";
import type { PlanSearchResultDTO } from "../api/types";

interface PlanSearchInputProps {
  placeholder?: string;
  onSelect?: (result: PlanSearchResultDTO) => void;
}

export default function PlanSearchInput({
  placeholder = "Search plans…",
  onSelect,
}: PlanSearchInputProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlanSearchResultDTO[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      setLoading(true);
      void searchPlans(query.trim())
        .then((data) => setResults(data.results))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => window.clearTimeout(handle);
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
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label="Search plans"
      />
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
