import { useCallback, useState } from "react";
import { isApiError, type ApiErrorDetail } from "../api/types";

interface UseAsyncActionOptions {
  successMessage?: string;
}

export function useAsyncAction(options: UseAsyncActionOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorDetail | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearFeedback = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  const run = useCallback(
    async <T>(
      action: () => Promise<T>,
      message?: string,
    ): Promise<T | null> => {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        const result = await action();
        setSuccessMessage(message ?? options.successMessage ?? null);
        return result;
      } catch (err) {
        if (isApiError(err)) {
          setError(err.detail);
        } else {
          setError({
            errors: [
              {
                code: "UNKNOWN",
                message: err instanceof Error ? err.message : "Request failed",
                details: {},
              },
            ],
          });
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [options.successMessage],
  );

  return {
    run,
    loading,
    error,
    successMessage,
    clearFeedback,
    setSuccessMessage,
    setError,
  };
}
