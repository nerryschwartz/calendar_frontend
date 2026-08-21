import { useCallback, useState } from "react";
import { refreshSchedule } from "../api/schedule";
import {
  isApiError,
  type ApiErrorDetail,
  type RefreshScheduleResult,
} from "../api/types";

export function useCalendarRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ApiErrorDetail | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshResult, setRefreshResult] =
    useState<RefreshScheduleResult | null>(null);

  const runRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await refreshSchedule();
      setRefreshResult(result);
      setSuccessMessage(
        `Schedule refreshed at ${new Date(result.run_started_at).toLocaleString()}`,
      );
      return result;
    } catch (err) {
      setRefreshResult(null);
      if (isApiError(err)) {
        setError(err.detail);
      } else {
        setError({
          errors: [
            {
              code: "UNKNOWN",
              message: err instanceof Error ? err.message : "Refresh failed",
              details: {},
            },
          ],
        });
      }
      return null;
    } finally {
      setRefreshing(false);
    }
  }, []);

  const clearFeedback = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  return {
    refreshing,
    error,
    successMessage,
    refreshResult,
    runRefresh,
    clearFeedback,
    setError,
  };
}
