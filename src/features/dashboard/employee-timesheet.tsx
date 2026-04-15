import { Fragment, useEffect, useMemo, useState } from "react";

import {
  TaskStatus,
  TimerState,
  toLocalDateAndTimeParts,
  type Activity,
  type Project,
  type Task,
  type Team,
  type TimeEntry,
  type User,
} from "@/shared";
import { LoadingButton } from "@/components/loading-button";
import { TaskDetailDrawer } from "@/components/task-detail-drawer";
import { api } from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

type EmployeeDashboardResponse = {
  period: {
    type: "today" | "week" | "month";
    label: string;
    offset: number;
    start: string;
    end: string;
  };
  utilizationCards: Array<{ label: string; value: string; helper: string }>;
};

type TaskDetailResponse = {
  task: Task;
  entries: TimeEntry[];
  project: Project | null;
  activity: Activity | null;
  assignee: User | null;
  assignees: User[];
  assignedTeams: Team[];
  createdBy: User | null;
};

const formatDuration = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hrs, mins, secs]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};

const statusClassMap: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: "timesheet-status timesheet-status--neutral",
  [TaskStatus.WIP]: "timesheet-status timesheet-status--muted",
  [TaskStatus.ON_HOLD]: "timesheet-status timesheet-status--outline",
  [TaskStatus.APPROVAL_PENDING]: "timesheet-status timesheet-status--outline",
  [TaskStatus.REJECTED]: "timesheet-status timesheet-status--danger",
  [TaskStatus.COMPLETED]: "timesheet-status timesheet-status--dark",
};

const statusLabelMap: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: "Pending",
  [TaskStatus.WIP]: "WIP",
  [TaskStatus.ON_HOLD]: "On Hold",
  [TaskStatus.APPROVAL_PENDING]: "Approval Pending",
  [TaskStatus.REJECTED]: "Rejected",
  [TaskStatus.COMPLETED]: "Completed",
};

const isDateInRange = (
  value: string | null | undefined,
  start: number,
  end: number,
) => {
  if (!value) {
    return false;
  }

  const date = new Date(value).getTime();
  return date >= start && date <= end;
};

export const EmployeeTimesheetPage = () => {
  const [period, setPeriod] = useState<"today" | "week" | "month">("week");
  const [offset, setOffset] = useState(0);
  const [dashboard, setDashboard] = useState<EmployeeDashboardResponse | null>(
    null,
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showManualLogForm, setShowManualLogForm] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [pendingTimerAction, setPendingTimerAction] = useState<
    "pause" | "stop" | "switch" | null
  >(null);
  const [countInput, setCountInput] = useState("");
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [expandedTaskDetails, setExpandedTaskDetails] = useState<
    Record<string, TaskDetailResponse>
  >({});
  const [expandedLoadingTaskId, setExpandedLoadingTaskId] = useState<
    string | null
  >(null);
  const [manualLog, setManualLog] = useState({
    taskId: "",
    startTimeUtc: "",
    endTimeUtc: "",
    description: "",
    reason: "",
  });

  const load = async (nextPeriod = period, nextOffset = offset) => {
    const [
      dashboardData,
      projectsData,
      activitiesData,
      tasksData,
      entriesData,
    ] = await Promise.all([
      api<EmployeeDashboardResponse>(
        `/analytics/dashboard?period=${nextPeriod}&offset=${nextOffset}`,
      ),
      api<Project[]>("/projects"),
      api<Activity[]>("/activities"),
      api<Task[]>("/tasks?excludeCompleted=true"),
      api<TimeEntry[]>("/time-tracking/entries"),
    ]);
    const runningEntryData =
      entriesData.find((entry) => entry.timerState === TimerState.RUNNING) ??
      null;

    setDashboard(dashboardData);
    setProjects(projectsData);
    setActivities(activitiesData);
    setTasks(tasksData);
    setEntries(entriesData);
    const nextDefaultTaskId =
      tasksData.find((task) => task.id === runningEntryData?.taskId)?.id ??
      tasksData.find((task) => task.id === selectedTaskId)?.id ??
      tasksData[0]?.id ??
      "";

    setSelectedTaskId((current) => {
      if (current && tasksData.some((task) => task.id === current)) {
        return current;
      }

      return nextDefaultTaskId;
    });
    setManualLog((current) => ({
      ...current,
      taskId:
        current.taskId ||
        tasksData.find((task) => task.status !== TaskStatus.COMPLETED)?.id ||
        "",
    }));
  };

  useEffect(() => {
    void load(period, offset);
  }, [period, offset]);

  const runningEntry = useMemo(
    () =>
      entries.find((entry) => entry.timerState === TimerState.RUNNING) ?? null,
    [entries],
  );

  const runningTask = useMemo(
    () => tasks.find((task) => task.id === runningEntry?.taskId) ?? null,
    [tasks, runningEntry],
  );

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  const currentActionTask = selectedTask ?? runningTask ?? null;

  const countContextTask =
    pendingTimerAction === "switch" ? runningTask : currentActionTask;
  const countContextRemaining = Math.max(
    0,
    (countContextTask?.countNumber ?? 0) -
      (countContextTask?.totalCountCompleted ?? 0),
  );

  const remainingCount = Math.max(
    0,
    (currentActionTask?.countNumber ?? 0) -
      (currentActionTask?.totalCountCompleted ?? 0),
  );

  const selectedTaskEntries = useMemo(
    () => entries.filter((entry) => entry.taskId === currentActionTask?.id),
    [currentActionTask?.id, entries],
  );

  const periodEntries = useMemo(() => {
    if (!dashboard?.period) {
      return entries;
    }

    const start = new Date(dashboard.period.start).getTime();
    const end = new Date(dashboard.period.end).getTime();

    return entries.filter((entry) => {
      const entryStart = new Date(entry.startTimeUtc).getTime();
      return entryStart >= start && entryStart <= end;
    });
  }, [dashboard?.period, entries]);

  const periodTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          periodEntries.some((entry) => entry.taskId === task.id) ||
          runningEntry?.taskId === task.id ||
          isDateInRange(
            task.createdAt,
            new Date(dashboard?.period.start ?? 0).getTime(),
            new Date(dashboard?.period.end ?? 0).getTime(),
          ) ||
          isDateInRange(
            task.updatedAt,
            new Date(dashboard?.period.start ?? 0).getTime(),
            new Date(dashboard?.period.end ?? 0).getTime(),
          ) ||
          isDateInRange(
            task.startedAtUtc,
            new Date(dashboard?.period.start ?? 0).getTime(),
            new Date(dashboard?.period.end ?? 0).getTime(),
          ) ||
          isDateInRange(
            task.completedAtUtc,
            new Date(dashboard?.period.start ?? 0).getTime(),
            new Date(dashboard?.period.end ?? 0).getTime(),
          ) ||
          isDateInRange(
            task.dueDateUtc,
            new Date(dashboard?.period.start ?? 0).getTime(),
            new Date(dashboard?.period.end ?? 0).getTime(),
          ),
      ),
    [
      dashboard?.period.end,
      dashboard?.period.start,
      periodEntries,
      runningEntry?.taskId,
      tasks,
    ],
  );

  const selectedTaskRunningEntry = useMemo(
    () =>
      selectedTaskEntries.find(
        (entry) => entry.timerState === TimerState.RUNNING,
      ) ?? null,
    [selectedTaskEntries],
  );

  const selectedTaskIsRunning = Boolean(selectedTaskRunningEntry);

  const selectedTaskTotalSeconds = useMemo(
    () =>
      selectedTaskEntries.reduce(
        (sum, entry) =>
          sum + (entry.durationSeconds ?? entry.durationMinutes * 60),
        0,
      ),
    [selectedTaskEntries],
  );

  const selectedTaskPreviouslyLoggedSeconds = useMemo(
    () =>
      selectedTaskEntries
        .filter((entry) => entry.id !== selectedTaskRunningEntry?.id)
        .reduce(
          (sum, entry) =>
            sum + (entry.durationSeconds ?? entry.durationMinutes * 60),
          0,
        ),
    [selectedTaskEntries, selectedTaskRunningEntry?.id],
  );

  const canStartTask =
    Boolean(currentActionTask) &&
    !runningEntry &&
    currentActionTask?.status !== TaskStatus.APPROVAL_PENDING &&
    currentActionTask?.status !== TaskStatus.COMPLETED;

  const canRequestCompletion =
    Boolean(currentActionTask) &&
    currentActionTask?.status !== TaskStatus.PENDING &&
    currentActionTask?.status !== TaskStatus.WIP &&
    currentActionTask?.status !== TaskStatus.APPROVAL_PENDING &&
    currentActionTask?.status !== TaskStatus.COMPLETED;

  const canStartFromCard =
    Boolean(currentActionTask) &&
    !runningEntry &&
    currentActionTask?.status !== TaskStatus.APPROVAL_PENDING &&
    currentActionTask?.status !== TaskStatus.COMPLETED;

  const canSwitchTaskFromCard =
    Boolean(currentActionTask) &&
    Boolean(runningTask) &&
    runningTask?.id !== currentActionTask?.id &&
    currentActionTask?.status !== TaskStatus.APPROVAL_PENDING &&
    currentActionTask?.status !== TaskStatus.COMPLETED;

  const startableTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status === TaskStatus.PENDING ||
          task.status === TaskStatus.WIP ||
          task.status === TaskStatus.ON_HOLD ||
          task.status === TaskStatus.REJECTED,
      ),
    [tasks],
  );

  const getProjectName = (projectId: string) =>
    projects.find((project) => project.id === projectId)?.name ?? projectId;

  const getActivityName = (activityId: string) =>
    activities.find((activity) => activity.id === activityId)?.name ??
    activityId;

  const toggleExpandedTask = async (taskId: string) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
      return;
    }

    setExpandedTaskId(taskId);

    if (expandedTaskDetails[taskId]) {
      return;
    }

    setExpandedLoadingTaskId(taskId);
    try {
      const detail = await api<TaskDetailResponse>(`/tasks/${taskId}`);
      setExpandedTaskDetails((current) => ({ ...current, [taskId]: detail }));
    } finally {
      setExpandedLoadingTaskId(null);
    }
  };

  const getAssigneeStatus = (task: Task, assigneeEntries: TimeEntry[]) => {
    if (
      assigneeEntries.some((entry) => entry.timerState === TimerState.RUNNING)
    ) {
      return { label: "WIP", className: statusClassMap[TaskStatus.WIP] };
    }

    if (assigneeEntries.length === 0) {
      return {
        label: "Not Started",
        className: statusClassMap[TaskStatus.PENDING],
      };
    }

    const latestEntry = [...assigneeEntries].sort(
      (left, right) =>
        new Date(right.endTimeUtc ?? right.startTimeUtc).getTime() -
        new Date(left.endTimeUtc ?? left.startTimeUtc).getTime(),
    )[0];

    if (task.status === TaskStatus.COMPLETED) {
      return {
        label: "Completed",
        className: statusClassMap[TaskStatus.COMPLETED],
      };
    }

    if (latestEntry?.timerState === TimerState.PAUSED) {
      return {
        label: "On Hold",
        className: statusClassMap[TaskStatus.ON_HOLD],
      };
    }

    return {
      label: "Stopped",
      className: statusClassMap[TaskStatus.APPROVAL_PENDING],
    };
  };

  useEffect(() => {
    if (!currentActionTask) {
      setElapsedSeconds(0);
      return;
    }

    const compute = () => {
      if (!selectedTaskRunningEntry) {
        setElapsedSeconds(selectedTaskTotalSeconds);
        return;
      }

      const startMs = new Date(selectedTaskRunningEntry.startTimeUtc).getTime();
      const storedSeconds =
        selectedTaskRunningEntry.durationSeconds ??
        selectedTaskRunningEntry.durationMinutes * 60;
      const liveSeconds = Math.max(
        0,
        Math.floor((Date.now() - startMs) / 1000),
      );
      setElapsedSeconds(
        selectedTaskPreviouslyLoggedSeconds +
          Math.max(storedSeconds, liveSeconds),
      );
    };

    compute();
    const timerId = window.setInterval(compute, 1000);
    return () => window.clearInterval(timerId);
  }, [
    currentActionTask?.id,
    selectedTaskRunningEntry?.id,
    selectedTaskTotalSeconds,
    selectedTaskPreviouslyLoggedSeconds,
  ]);

  useEffect(() => {
    if (!selectedTaskId && tasks.length > 0) {
      setSelectedTaskId(tasks[0]?.id ?? "");
    }
  }, [selectedTaskId, tasks]);

  const handleTimerTransition = async (
    action: "pause" | "stop",
    taskId: string,
    countCompleted?: number,
  ) => {
    setLoadingAction(action === "pause" ? "pause-task" : "stop-task");
    try {
      await api(`/tasks/${taskId}/timer-transition`, {
        method: "POST",
        body: JSON.stringify({
          timerState:
            action === "pause" ? TimerState.PAUSED : TimerState.STOPPED,
          countCompleted,
        }),
        suppressGlobalLoader: true,
      });
      showSuccessToast(action === "pause" ? "Timer paused" : "Timer stopped");
      await load();
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCountActionConfirm = async () => {
    if (!pendingTimerAction || !countContextTask) {
      return;
    }

    const parsedCount = Number(countInput);
    if (
      !Number.isFinite(parsedCount) ||
      !Number.isInteger(parsedCount) ||
      parsedCount < 0
    ) {
      showErrorToast("Enter a valid whole-number count");
      return;
    }

    if (parsedCount > countContextRemaining) {
      showErrorToast(
        `Completed count cannot exceed remaining count (${countContextRemaining})`,
      );
      return;
    }

    if (pendingTimerAction === "switch") {
      setLoadingAction("switch-task");
      try {
        await api(`/tasks/${countContextTask.id}/timer-transition`, {
          method: "POST",
          body: JSON.stringify({
            timerState: TimerState.STOPPED,
            countCompleted: parsedCount,
          }),
          suppressGlobalLoader: true,
        });

        await api(`/tasks/${currentActionTask!.id}/start-timer`, {
          method: "POST",
          suppressGlobalLoader: true,
        });

        showSuccessToast("Switched active task");
        await load();
      } finally {
        setLoadingAction(null);
      }
    } else {
      await handleTimerTransition(
        pendingTimerAction,
        countContextTask.id,
        parsedCount,
      );
    }

    setPendingTimerAction(null);
    setCountInput("");
  };

  return (
    <div className="timesheet-page">
      <TaskDetailDrawer
        isOpen={Boolean(drawerTaskId)}
        onClose={() => setDrawerTaskId(null)}
        onTaskUpdated={() => load()}
        taskId={drawerTaskId}
      />
      <div className="timesheet-section-header">
        <div className="timesheet-header-copy">
          <h2>Work Log Summary</h2>
          <p>{dashboard?.period.label ?? "Loading range..."}</p>
        </div>
        <div className="timesheet-header-controls">
          <div className="manager-period-switcher">
            {(["today", "week", "month"] as const).map((option) => (
              <button
                key={option}
                className={option === period ? "is-active" : ""}
                onClick={() => {
                  setPeriod(option);
                  setOffset(0);
                }}
                type="button"
              >
                {option === "today"
                  ? "Today"
                  : option === "week"
                    ? "Weekly"
                    : "Monthly"}
              </button>
            ))}
          </div>
          <div className="manager-week-switcher">
            <button
              onClick={() => setOffset((current) => current - 1)}
              type="button"
            >
              ‹ Prev
            </button>
            <strong>{dashboard?.period.label ?? "Loading range..."}</strong>
            <button
              disabled={offset === 0}
              onClick={() => setOffset((current) => Math.min(0, current + 1))}
              type="button"
            >
              Next ›
            </button>
          </div>
        </div>
      </div>
      <div className="timesheet-action-row">
        <select
          className="timesheet-task-select"
          value={selectedTaskId}
          onChange={(event) => setSelectedTaskId(event.target.value)}
        >
          <option value="">Select Task</option>
          {startableTasks.map((task) => (
            <option key={task.id} value={task.id}>
              {getProjectName(task.projectId)} |{" "}
              {getActivityName(task.activityId)} | {task.title}
            </option>
          ))}
        </select>
        {canStartTask ? (
          <LoadingButton
            className="timesheet-primary-button"
            loading={loadingAction === "start-task"}
            onClick={async () => {
              setLoadingAction("start-task");
              setSelectedTaskId(currentActionTask!.id);
              try {
                await api(`/tasks/${currentActionTask!.id}/start-timer`, {
                  method: "POST",
                  suppressGlobalLoader: true,
                });
                showSuccessToast("Timer started");
                await load();
              } finally {
                setLoadingAction(null);
              }
            }}
            type="button"
          >
            Start Task
          </LoadingButton>
        ) : null}
        <button
          className="timesheet-secondary-button"
          onClick={() => setShowManualLogForm((current) => !current)}
          type="button"
        >
          + Log Manually
        </button>
      </div>

      {currentActionTask ? (
        <section className="timesheet-timer-card">
          <div className="timesheet-timer-meta">
            <div
              className={`timesheet-dot ${selectedTaskIsRunning ? "timesheet-dot--active" : ""}`}
            />
            <span className="timesheet-label">
              {selectedTaskIsRunning ? "Active Timer" : "Selected Task"}
            </span>
          </div>
          <div className="timesheet-timer-grid">
            <div>
              <h3>{getProjectName(currentActionTask.projectId)}</h3>
              <p className="timesheet-secondary-meta">
                {getActivityName(currentActionTask.activityId)}
              </p>
              <p className="timesheet-inline-meta">
                <span>Task: {currentActionTask.title}</span>
                <span>|</span>
                <span>
                  Status:{" "}
                  <span className={statusClassMap[currentActionTask.status]}>
                    {statusLabelMap[currentActionTask.status]}
                  </span>
                </span>
                {currentActionTask.hasCountTracking ? (
                  <>
                    <span>|</span>
                    <span>
                      Count: {currentActionTask.totalCountCompleted} at{" "}
                      {currentActionTask.benchmarkMinutesPerCount ?? 0}{" "}
                      mins/count
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <div className="timesheet-running-time">
              {formatDuration(elapsedSeconds)}
            </div>
            <div className="timesheet-timer-actions">
              {selectedTaskIsRunning ? (
                <div className="timesheet-button-inline">
                  <LoadingButton
                    className="timesheet-secondary-button"
                    loading={loadingAction === "pause-task"}
                    onClick={async () => {
                      if (currentActionTask.hasCountTracking) {
                        setPendingTimerAction("pause");
                        setCountInput("");
                        return;
                      }
                      await handleTimerTransition(
                        "pause",
                        currentActionTask.id,
                      );
                    }}
                    type="button"
                  >
                    Pause
                  </LoadingButton>
                  <LoadingButton
                    className="timesheet-primary-button"
                    loading={loadingAction === "stop-task"}
                    onClick={async () => {
                      if (currentActionTask.hasCountTracking) {
                        setPendingTimerAction("stop");
                        setCountInput("");
                        return;
                      }
                      await handleTimerTransition("stop", currentActionTask.id);
                    }}
                    type="button"
                  >
                    Stop
                  </LoadingButton>
                </div>
              ) : canSwitchTaskFromCard ? (
                <LoadingButton
                  className="timesheet-primary-button"
                  loading={loadingAction === "switch-task"}
                  onClick={async () => {
                    if (runningTask?.hasCountTracking) {
                      setPendingTimerAction("switch");
                      setCountInput("");
                      return;
                    }

                    setLoadingAction("switch-task");
                    setSelectedTaskId(currentActionTask.id);
                    try {
                      await api(`/tasks/${runningTask!.id}/timer-transition`, {
                        method: "POST",
                        body: JSON.stringify({
                          timerState: TimerState.STOPPED,
                        }),
                        suppressGlobalLoader: true,
                      });
                      await api(`/tasks/${currentActionTask.id}/start-timer`, {
                        method: "POST",
                        suppressGlobalLoader: true,
                      });
                      showSuccessToast("Switched active task");
                      await load();
                    } finally {
                      setLoadingAction(null);
                    }
                  }}
                  type="button"
                >
                  {currentActionTask.status === TaskStatus.ON_HOLD
                    ? "Switch & Resume"
                    : "Switch & Start"}
                </LoadingButton>
              ) : canStartFromCard ? (
                <LoadingButton
                  className="timesheet-primary-button"
                  loading={loadingAction === "resume-task"}
                  onClick={async () => {
                    setLoadingAction("resume-task");
                    setSelectedTaskId(currentActionTask.id);
                    try {
                      await api(`/tasks/${currentActionTask.id}/start-timer`, {
                        method: "POST",
                        suppressGlobalLoader: true,
                      });
                      showSuccessToast("Work resumed");
                      await load();
                    } finally {
                      setLoadingAction(null);
                    }
                  }}
                  type="button"
                >
                  {currentActionTask.status === TaskStatus.ON_HOLD
                    ? "Resume"
                    : "Start Timer"}
                </LoadingButton>
              ) : null}
              {canRequestCompletion ? (
                <LoadingButton
                  className="timesheet-secondary-button"
                  loading={loadingAction === "mark-completed"}
                  onClick={async () => {
                    setLoadingAction("mark-completed");
                    try {
                      await api(
                        `/tasks/${currentActionTask.id}/request-completion`,
                        {
                          method: "POST",
                          suppressGlobalLoader: true,
                        },
                      );
                      showSuccessToast("Task marked as completed");
                      await load();
                    } finally {
                      setLoadingAction(null);
                    }
                  }}
                  type="button"
                >
                  Mark Completed
                </LoadingButton>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {showManualLogForm ? (
        <section className="timesheet-manual-card">
          <form
            className="timesheet-manual-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setLoadingAction("manual-log");
              try {
                await api(`/tasks/${manualLog.taskId}/manual-log`, {
                  method: "POST",
                  body: JSON.stringify({
                    ...manualLog,
                    startTimeUtc: new Date(
                      manualLog.startTimeUtc,
                    ).toISOString(),
                    endTimeUtc: new Date(manualLog.endTimeUtc).toISOString(),
                  }),
                  suppressGlobalLoader: true,
                });
                showSuccessToast("Manual log request submitted");
                setManualLog({
                  taskId: currentActionTask?.id ?? "",
                  startTimeUtc: "",
                  endTimeUtc: "",
                  description: "",
                  reason: "",
                });
                setShowManualLogForm(false);
                await load();
              } finally {
                setLoadingAction(null);
              }
            }}
          >
            <select
              className="input"
              value={manualLog.taskId}
              onChange={(event) =>
                setManualLog((current) => ({
                  ...current,
                  taskId: event.target.value,
                }))
              }
            >
              <option value="">Select task</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="datetime-local"
              value={manualLog.startTimeUtc}
              onChange={(event) =>
                setManualLog((current) => ({
                  ...current,
                  startTimeUtc: event.target.value,
                }))
              }
            />
            <input
              className="input"
              type="datetime-local"
              value={manualLog.endTimeUtc}
              onChange={(event) =>
                setManualLog((current) => ({
                  ...current,
                  endTimeUtc: event.target.value,
                }))
              }
            />
            <input
              className="input"
              placeholder="Description"
              value={manualLog.description}
              onChange={(event) =>
                setManualLog((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
            <input
              className="input"
              placeholder="Reason for approval"
              value={manualLog.reason}
              onChange={(event) =>
                setManualLog((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
            />
            <LoadingButton
              className="timesheet-primary-button"
              loading={loadingAction === "manual-log"}
              type="submit"
            >
              Submit Manual Log
            </LoadingButton>
          </form>
        </section>
      ) : null}

      <section className="timesheet-entries-section">
        <h3>
          {period === "today"
            ? "Today's Entries"
            : period === "week"
              ? "Weekly Entries"
              : "Monthly Entries"}{" "}
          — {dashboard?.period.label ?? ""}
        </h3>
        <div style={{ paddingTop: "10px" }}></div>
        <div className="timesheet-table-card">
          <table className="timesheet-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Activity</th>
                <th>Assigned To</th>
                <th>Task</th>
                <th>Logged Time</th>
                <th>Status</th>
                <th>Comments</th>
                <th>Timer</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {periodTasks.map((task) => {
                const taskEntries = periodEntries.filter(
                  (entry) => entry.taskId === task.id,
                );
                const totalSeconds = taskEntries.reduce(
                  (sum, entry) =>
                    sum + (entry.durationSeconds ?? entry.durationMinutes * 60),
                  0,
                );
                const detail = expandedTaskDetails[task.id];
                const isExpanded = expandedTaskId === task.id;
                return (
                  <Fragment key={task.id}>
                    <tr
                      className={`timesheet-table-row ${selectedTaskId === task.id ? "timesheet-table-row--selected" : ""} ${isExpanded ? "manager-task-row--expanded" : ""}`}
                      onClick={() => {
                        if (task.status !== TaskStatus.COMPLETED) {
                          setSelectedTaskId(task.id);
                        }
                      }}
                    >
                      <td className="timesheet-strong-cell">
                        {getProjectName(task.projectId)}
                      </td>
                      <td>{getActivityName(task.activityId)}</td>
                      <td>
                        <div className="timesheet-assignee-cell">
                          {(task.teamNames ?? []).map((name) => (
                            <span key={name} className="timesheet-team-pill">
                              {name}
                            </span>
                          ))}
                          {(task.assigneeNames ?? []).map((name) => (
                            <span key={name} className="timesheet-user-name">
                              {name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>{task.title}</td>
                      <td>{formatDuration(totalSeconds)}</td>
                      <td>
                        <span className={statusClassMap[task.status]}>
                          {statusLabelMap[task.status]}
                        </span>
                      </td>
                      <td className="timesheet-comment-cell">
                        {task.description.length > 26
                          ? `${task.description.slice(0, 26)}...`
                          : task.description}
                      </td>
                      <td>
                        {runningEntry?.taskId === task.id ? (
                          <span className="timesheet-status timesheet-status--success">
                            Active Timer
                          </span>
                        ) : (
                          <span className="timesheet-status timesheet-status--ghost">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="manager-task-actions">
                          <button
                            className="manager-task-detail-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDrawerTaskId(task.id);
                            }}
                            type="button"
                          >
                            Detail
                          </button>

                          <button
                            className="manager-task-expand-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleExpandedTask(task.id);
                            }}
                            title={isExpanded ? "Collapse" : "Expand"}
                            type="button"
                          >
                            {isExpanded ? (
                              <svg
                                fill="none"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2.5"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="m18 15-6-6-6 6" />
                              </svg>
                            ) : (
                              <svg
                                fill="none"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2.5"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="m6 9 6 6 6-6" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="manager-task-expand-row">
                        <td colSpan={8}>
                          <div className="manager-task-expand-card">
                            {expandedLoadingTaskId === task.id && !detail ? (
                              <p className="manager-dashboard-inactive">
                                Loading task details...
                              </p>
                            ) : detail ? (
                              <>
                                <div className="manager-task-expand-meta">
                                  <div>
                                    <span>Assignment</span>
                                    <strong>
                                      {detail.assignedTeams.length > 0
                                        ? `Team: ${detail.assignedTeams
                                            .map((team) => team.name)
                                            .join(", ")}`
                                        : detail.assignees
                                            .map((a) => a.fullName)
                                            .join(", ")}
                                    </strong>
                                  </div>
                                  <div>
                                    <span>Count Tracking</span>
                                    <strong>
                                      {detail.task.hasCountTracking
                                        ? `${detail.task.totalCountCompleted}/${detail.task.countNumber ?? 0} completed`
                                        : "No"}
                                    </strong>
                                  </div>
                                  <div>
                                    <span>Benchmark</span>
                                    <strong>
                                      {detail.task.hasCountTracking
                                        ? `${detail.task.benchmarkMinutesPerCount ?? 0} mins / count`
                                        : `${detail.task.estimatedHours.toFixed(2)} hours estimated`}
                                    </strong>
                                  </div>
                                  <div>
                                    <span>Assigned By</span>
                                    <strong>
                                      {detail.createdBy?.fullName ?? "N/A"}
                                    </strong>
                                  </div>
                                </div>
                                <div className="manager-task-expand-description">
                                  <span>Description</span>
                                  <p>{detail.task.description}</p>
                                </div>
                                <div className="manager-task-assignee-block">
                                  <div className="manager-task-assignee-block__header">
                                    <h4>Employee Status</h4>
                                    <p>
                                      Task progress details for each assigned
                                      employee
                                    </p>
                                  </div>
                                  <div className="manager-task-assignee-grid">
                                    {detail.assignees.map((assignee) => {
                                      const assigneeEntries =
                                        detail.entries.filter(
                                          (entry) =>
                                            entry.employeeId === assignee.id,
                                        );
                                      const totalLoggedSeconds =
                                        assigneeEntries.reduce(
                                          (sum, entry) =>
                                            sum +
                                            (entry.durationSeconds ??
                                              entry.durationMinutes * 60),
                                          0,
                                        );
                                      const totalCountCompleted =
                                        assigneeEntries.reduce(
                                          (sum, entry) =>
                                            sum + (entry.countCompleted ?? 0),
                                          0,
                                        );
                                      const firstStartedAt = assigneeEntries
                                        .map((entry) => entry.startTimeUtc)
                                        .sort()[0];
                                      const lastEndedAt = assigneeEntries
                                        .map(
                                          (entry) =>
                                            entry.endTimeUtc ??
                                            entry.startTimeUtc,
                                        )
                                        .sort()
                                        .at(-1);
                                      const assigneeStatus = getAssigneeStatus(
                                        detail.task,
                                        assigneeEntries,
                                      );
                                      const firstStarted =
                                        toLocalDateAndTimeParts(
                                          firstStartedAt,
                                          assignee.timezone,
                                        );
                                      const lastEnded = toLocalDateAndTimeParts(
                                        lastEndedAt,
                                        assignee.timezone,
                                      );

                                      return (
                                        <article
                                          key={assignee.id}
                                          className="manager-task-assignee-card"
                                        >
                                          <div className="manager-task-assignee-card__top">
                                            <div>
                                              <strong>
                                                {assignee.fullName}
                                              </strong>
                                              <span>{assignee.email}</span>
                                            </div>
                                            <span
                                              className={
                                                assigneeStatus.className
                                              }
                                            >
                                              {assigneeStatus.label}
                                            </span>
                                          </div>
                                          <div className="manager-task-assignee-card__metrics">
                                            <div>
                                              <span>Logged</span>
                                              <strong>
                                                {formatDuration(
                                                  totalLoggedSeconds,
                                                )}
                                              </strong>
                                            </div>
                                            <div>
                                              <span>Start Time</span>
                                              <strong className="task-date-time-cell">
                                                <span>{firstStarted.date}</span>
                                                <span>{firstStarted.time}</span>
                                              </strong>
                                            </div>
                                            <div>
                                              <span>End Time</span>
                                              <strong className="task-date-time-cell">
                                                <span>{lastEnded.date}</span>
                                                <span>{lastEnded.time}</span>
                                              </strong>
                                            </div>
                                            {detail.task.hasCountTracking ? (
                                              <div>
                                                <span>Count Completed</span>
                                                <strong>
                                                  {totalCountCompleted}
                                                </strong>
                                              </div>
                                            ) : null}
                                            <div>
                                              <span>Sessions</span>
                                              <strong>
                                                {assigneeEntries.length}
                                              </strong>
                                            </div>
                                          </div>
                                        </article>
                                      );
                                    })}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <p className="manager-dashboard-inactive">
                                Task details could not be loaded.
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {periodTasks.length === 0 ? (
                <tr>
                  <td className="employee-task-table__empty" colSpan={8}>
                    No entries found for the selected period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="timesheet-utilization">
        <h3>My Utilization Summary</h3>
        <div className="timesheet-kpi-grid">
          {(dashboard?.utilizationCards ?? []).map((stat) => {
            const numericValue = Number.parseInt(
              stat.value.replace("%", ""),
              10,
            );
            return (
              <div key={stat.label} className="timesheet-kpi-card">
                <span className="timesheet-kpi-label">{stat.label}</span>
                <strong className="timesheet-kpi-value">{stat.value}</strong>
                <p>{stat.helper}</p>
                {Number.isNaN(numericValue) ? null : (
                  <div className="timesheet-progress-track">
                    <div
                      className="timesheet-progress-fill"
                      style={{ width: `${numericValue}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      {pendingTimerAction && countContextTask ? (
        <div
          className="task-modal-overlay"
          onClick={() => setPendingTimerAction(null)}
          role="presentation"
        >
          <div
            className="task-modal task-modal--compact"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="task-modal__close task-modal__close--floating"
              onClick={() => setPendingTimerAction(null)}
              type="button"
            >
              ×
            </button>
            <h3 className="task-modal__success-title">Enter Count</h3>
            <p className="task-modal__success-copy">
              Add the completed count for{" "}
              <strong>{countContextTask.title}</strong> before you{" "}
              {pendingTimerAction === "pause"
                ? "pause"
                : pendingTimerAction === "switch"
                  ? "switch"
                  : "stop"}{" "}
              the timer.
            </p>
            <p className="task-modal__success-copy">
              Remaining count: {countContextRemaining} out of{" "}
              {countContextTask.countNumber ?? 0}
            </p>
            <input
              className="task-modal__input"
              min="0"
              max={countContextRemaining}
              step="1"
              type="number"
              value={countInput}
              onChange={(event) => setCountInput(event.target.value)}
            />
            <div className="task-modal__actions">
              <button
                className="timesheet-secondary-button"
                onClick={() => setPendingTimerAction(null)}
                type="button"
              >
                Cancel
              </button>
              <LoadingButton
                className="timesheet-primary-button"
                loading={loadingAction === `${pendingTimerAction}-task`}
                onClick={() => void handleCountActionConfirm()}
                type="button"
              >
                Confirm
              </LoadingButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
