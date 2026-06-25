import { useState, useEffect, useCallback, useRef } from "react";

export interface LogEntry {
  step: string;
  log: string;
  status: string;
}

export interface Repo {
  id: string;
  github_url: string;
  name: string;
  owner: string;
  analysis_status: "queued" | "running" | "complete" | "failed";
  created_at: string;
}

export function useRepoAnalysis(repoId: string) {
  const [repo, setRepo] = useState<Repo | null>(null);
  const [status, setStatus] = useState<Repo["analysis_status"] | "loading">("loading");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentStep, setCurrentStep] = useState<string>("init");
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchRepoDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/repos/${repoId}`);
      if (res.status === 404) {
        setIsNotFound(true);
        setError("Repository not found (404).");
        setStatus("failed");
        return null;
      }
      if (!res.ok) {
        throw new Error(`Failed to load repository: HTTP ${res.status}`);
      }
      const data = await res.json();
      setRepo(data);
      setStatus(data.analysis_status);
      setIsNotFound(false);
      return data as Repo;
    } catch (err: any) {
      console.error("Error fetching repo details:", err);
      setError(err.message || "Failed to load repository details.");
      setStatus("failed");
      return null;
    }
  }, [repoId]);

  useEffect(() => {
    if (isNotFound) return;
    let active = true;

    async function init() {
      const currentRepo = await fetchRepoDetails();
      if (!active || !currentRepo) return;

      // Connect to SSE stream for all states (replays history for completed)
      if (
        currentRepo.analysis_status === "queued" ||
        currentRepo.analysis_status === "running" ||
        currentRepo.analysis_status === "complete"
      ) {
        connectToStream();
      }
    }

    function connectToStream() {
      // Close any existing event source
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const streamUrl = `/api/repos/${repoId}/stream`;
      console.log(`Connecting to SSE stream: ${streamUrl}`);
      
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        if (!active) return;
        try {
          const data = JSON.parse(event.data);
          console.log("SSE Message:", data);

          if (data.step && data.log) {
            setLogs((prev) => {
              // Avoid duplicate logs if they arrive multiple times
              const exists = prev.some(
                (l) => l.log === data.log && l.step === data.step
              );
              if (exists) return prev;
              return [...prev, { step: data.step, log: data.log, status: data.status }];
            });
            setCurrentStep(data.step);
          }

          if (data.status) {
            setStatus(data.status);
            setRepo((prev) => prev ? { ...prev, analysis_status: data.status } : null);
          }

          if (data.status === "complete" || data.status === "failed") {
            console.log(`SSE stream finished with status: ${data.status}`);
            es.close();
          }
        } catch (err) {
          console.error("Failed to parse SSE message:", err);
        }
      };

      es.onerror = (err) => {
        console.error("SSE Connection Error:", err);
        // Do not fail immediately, standard SSE will auto-reconnect.
        // But if state is already resolved to complete/failed, close it.
      };
    }

    init();

    return () => {
      active = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [repoId, fetchRepoDetails, isNotFound]);

  const refetch = useCallback(async () => {
    setLogs([]);
    setError(null);
    setStatus("loading");
    await fetchRepoDetails();
  }, [fetchRepoDetails]);

  const stopAnalysis = useCallback(async () => {
    try {
      const res = await fetch(`/api/repos/${repoId}/stop`, {
        method: "POST"
      });
      if (res.ok) {
        await fetchRepoDetails();
      }
    } catch (err) {
      console.error("Failed to stop analysis:", err);
    }
  }, [repoId, fetchRepoDetails]);

  const retryAnalysis = useCallback(async () => {
    try {
      setLogs([]);
      setError(null);
      setStatus("queued");
      const res = await fetch(`/api/repos/${repoId}/retry`, {
        method: "POST"
      });
      if (!res.ok) {
        throw new Error("Failed to retry analysis");
      }
      await fetchRepoDetails();
    } catch (err: any) {
      console.error("Failed to retry analysis:", err);
      setError(err.message);
      setStatus("failed");
    }
  }, [repoId, fetchRepoDetails]);

  return {
    repo,
    status,
    logs,
    currentStep,
    error,
    isNotFound,
    refetch,
    stopAnalysis,
    retryAnalysis,
  };
}
