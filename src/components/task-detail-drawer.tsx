import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  CommentVisibility,
  Priority,
  TaskStatus,
  TimerState,
  UserRole,
  toLocalDate,
  toLocalDateAndTimeParts,
  type ApprovalRequest,
  type Activity,
  type Comment,
  type Project,
  type Task,
  type Team,
  type TimeEntry,
  type User,
} from "@/shared";
import { LoadingButton } from "@/components/loading-button";
import { api } from "@/lib/api";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { useAuth } from "@/features/auth/auth-context";

type TaskDetailResponse = {
  task: Task;
  entries: TimeEntry[];
  comments: Comment[];
  approvals: ApprovalRequest[];
  project: Project | null;
  activity: Activity | null;
  assignee: User | null;
  assignees: User[];
  assignedTeams: Team[];
  createdBy: User | null;
  commentAuthors: User[];
};

type TaskDetailDrawerProps = {
  taskId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated?: () => Promise<void> | void;
};

const statusLabelMap: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: "Pending",
  [TaskStatus.WIP]: "WIP",
  [TaskStatus.ON_HOLD]: "On Hold",
  [TaskStatus.APPROVAL_PENDING]: "Approval Pending",
  [TaskStatus.REJECTED]: "Rejected",
  [TaskStatus.COMPLETED]: "Completed",
};

const priorityLabelMap: Record<Priority, string> = {
  [Priority.LOW]: "Low",
  [Priority.MEDIUM]: "Medium",
  [Priority.HIGH]: "High",
  [Priority.CRITICAL]: "Critical",
};

const approvalTypeLabelMap = {
  DUE_DATE_CHANGE: "Due Date Change",
  TASK_COMPLETION: "Task Completion",
  MANUAL_LOG: "Manual Log",
  TASK_UPDATE: "Task Update",
} as const;

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, "0")).join(":");
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

export const TaskDetailDrawer = ({
  taskId,
  isOpen,
  onClose,
  onTaskUpdated,
}: TaskDetailDrawerProps) => {
  const { user } = useAuth();
  const [detail, setDetail] = useState<TaskDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pendingTimerAction, setPendingTimerAction] = useState<"pause" | "stop" | null>(null);
  const [countInput, setCountInput] = useState("");
  const [requestedDueDate, setRequestedDueDate] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const load = async () => {
    if (!taskId) {
      return;
    }

    setLoading(true);
    try {
      const data = await api<TaskDetailResponse>(`/tasks/${taskId}`);
      setDetail(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !taskId) {
      return;
    }

    void load();
  }, [isOpen, taskId]);

  useEffect(() => {
    if (!isOpen) {
      setEditingCommentId(null);
      setEditingCommentBody("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!detail?.task.dueDateUtc) {
      return;
    }

    setRequestedDueDate(detail.task.dueDateUtc.slice(0, 10));
  }, [detail?.task.dueDateUtc]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const authorMap = useMemo(
    () => new Map((detail?.commentAuthors ?? []).map((author) => [author.id, author])),
    [detail?.commentAuthors],
  );

  const runningEntry = useMemo(
    () => detail?.entries.find((entry) => entry.timerState === TimerState.RUNNING) ?? null,
    [detail?.entries],
  );

  const previouslyLoggedSeconds = useMemo(() => {
    if (!detail) {
      return 0;
    }

    return detail.entries
      .filter((entry) => entry.id !== runningEntry?.id)
      .reduce((sum, entry) => sum + (entry.durationSeconds ?? entry.durationMinutes * 60), 0);
  }, [detail, runningEntry?.id]);

  useEffect(() => {
    if (!runningEntry) {
      setElapsedSeconds(0);
      return;
    }

    const compute = () => {
      const storedSeconds = runningEntry.durationSeconds ?? runningEntry.durationMinutes * 60;
      const startMs = new Date(runningEntry.startTimeUtc).getTime();
      const liveSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setElapsedSeconds(previouslyLoggedSeconds + Math.max(storedSeconds, liveSeconds));
    };

    compute();
    const intervalId = window.setInterval(compute, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [runningEntry?.id, previouslyLoggedSeconds]);

  const loggedSeconds = useMemo(() => {
    if (!detail) {
      return 0;
    }

    return detail.entries.reduce(
      (sum, entry) => sum + (entry.durationSeconds ?? entry.durationMinutes * 60),
      0,
    );
  }, [detail]);

  const task = detail?.task ?? null;
  const approvals = detail?.approvals ?? [];
  const taskAssigneeIds = task?.assigneeIds?.length ? task.assigneeIds : task?.assigneeId ? [task.assigneeId] : [];
  const assignedToLabel =
    detail?.assignees?.length
      ? detail.assignees.map((assignee) => assignee.fullName).join(", ")
      : detail?.assignee?.fullName ?? "N/A";
  const assignedTeamLabel = detail?.assignedTeams?.map((team) => team.name).join(", ") || "Direct employee assignment";
  const taskTimeZone =
    user?.userRole === UserRole.MANAGER ? detail?.assignee?.timezone : user?.timezone;
  const startedAt = toLocalDateAndTimeParts(detail?.task.startedAtUtc, taskTimeZone);
  const completedAt = toLocalDateAndTimeParts(detail?.task.completedAtUtc, taskTimeZone);
  const estimatedSeconds = (task?.estimatedHours ?? 0) * 3600;
  const completionPercent =
    estimatedSeconds > 0 ? Math.min(100, Math.round((loggedSeconds / estimatedSeconds) * 100)) : 0;
  const remainingCount = Math.max(0, (task?.countNumber ?? 0) - (task?.totalCountCompleted ?? 0));

  const canControlTimer =
    user?.userRole === UserRole.EMPLOYEE &&
    taskAssigneeIds.includes(user.id) &&
    task?.status !== TaskStatus.COMPLETED &&
    task?.status !== TaskStatus.APPROVAL_PENDING;

  const canRequestCompletion =
    user?.userRole === UserRole.EMPLOYEE &&
    taskAssigneeIds.includes(user.id) &&
    task?.status !== TaskStatus.PENDING &&
    task?.status !== TaskStatus.WIP &&
    task?.status !== TaskStatus.COMPLETED &&
    task?.status !== TaskStatus.APPROVAL_PENDING;

  const handleTaskRefresh = async (successMessage?: string) => {
    await load();

    if (onTaskUpdated) {
      await onTaskUpdated();
    }

    if (successMessage) {
      showSuccessToast(successMessage);
    }
  };

  const handleTimerAction = async (action: "start" | "pause" | "stop", countCompleted?: number) => {
    if (!detail) {
      return;
    }

    if (action === "start") {
      setLoadingAction("timer-start");
      try {
        await api(`/tasks/${detail.task.id}/start-timer`, {
          method: "POST",
          suppressGlobalLoader: true,
        });
        await handleTaskRefresh("Timer started");
      } finally {
        setLoadingAction(null);
      }
      return;
    }

    setLoadingAction(action === "pause" ? "timer-pause" : "timer-stop");
    try {
      await api(`/tasks/${detail.task.id}/timer-transition`, {
        method: "POST",
        body: JSON.stringify({
          timerState: action === "pause" ? TimerState.PAUSED : TimerState.STOPPED,
          countCompleted,
        }),
        suppressGlobalLoader: true,
      });
      await handleTaskRefresh(action === "pause" ? "Timer paused" : "Timer stopped");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCountActionConfirm = async () => {
    if (!pendingTimerAction) {
      return;
    }

    const parsedCount = Number(countInput);
    if (!Number.isFinite(parsedCount) || !Number.isInteger(parsedCount) || parsedCount < 0) {
      showErrorToast("Enter a valid whole-number count");
      return;
    }

    if (parsedCount > remainingCount) {
      showErrorToast(`Completed count cannot exceed remaining count (${remainingCount})`);
      return;
    }

    await handleTimerAction(pendingTimerAction, parsedCount);
    setPendingTimerAction(null);
    setCountInput("");
  };

  const handleCommentSubmit = async () => {
    if (!detail || !commentBody.trim()) {
      return;
    }

    setLoadingAction("comment-post");
    try {
      await api(`/comments/${detail.task.id}`, {
        method: "POST",
        body: JSON.stringify({
          body: commentBody.trim(),
          visibility: CommentVisibility.SHARED,
        }),
        suppressGlobalLoader: true,
      });

      setCommentBody("");
      await handleTaskRefresh("Comment posted");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDueDateRequest = async () => {
    if (!task || !requestedDueDate || !requestReason.trim()) {
      return;
    }

    setLoadingAction("due-date-request");
    try {
      await api(`/tasks/${task.id}/request-due-date-change`, {
        method: "POST",
        body: JSON.stringify({
          dueDateUtc: new Date(`${requestedDueDate}T00:00:00.000Z`).toISOString(),
          reason: requestReason.trim(),
        }),
        suppressGlobalLoader: true,
      });

      setShowEditModal(false);
      setShowSuccessModal(true);
      setRequestReason("");
      await handleTaskRefresh();
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCompletionRequest = async () => {
    if (!task) {
      return;
    }

    setLoadingAction("completion-request");
    try {
      await api(`/tasks/${task.id}/request-completion`, {
        method: "POST",
        suppressGlobalLoader: true,
      });
      await handleTaskRefresh("Task marked as completed");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCommentEditStart = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentBody(comment.body);
  };

  const handleCommentEditCancel = () => {
    setEditingCommentId(null);
    setEditingCommentBody("");
  };

  const handleCommentEditSave = async () => {
    if (!editingCommentId || !editingCommentBody.trim()) {
      return;
    }

    setLoadingAction(`comment-edit-${editingCommentId}`);
    try {
      await api(`/comments/${editingCommentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          body: editingCommentBody.trim(),
        }),
        suppressGlobalLoader: true,
      });

      setEditingCommentId(null);
      setEditingCommentBody("");
      await handleTaskRefresh("Comment updated");
    } finally {
      setLoadingAction(null);
    }
  };

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="task-drawer-overlay" onClick={onClose} role="presentation">
      <aside className="task-drawer" onClick={(event) => event.stopPropagation()}>
        {loading || !detail ? (
          <div className="task-drawer__loading">Loading task details...</div>
        ) : (
          <>
            <div className="task-drawer__header">
              <div>
                <h2>{detail.task.title}</h2>
                <p>{detail.project?.name ?? ""}</p>
              </div>
              <button className="task-drawer__close" onClick={onClose} type="button">
                ×
              </button>
            </div>

            <div className="task-drawer__content">
              <section className="task-drawer__meta-grid">
                <div>
                  <span>Activity</span>
                  <strong>{detail.activity?.name ?? "N/A"}</strong>
                </div>
                {user?.userRole === UserRole.MANAGER ? (
                  <div>
                    <span>Assigned To</span>
                    <strong>{assignedToLabel}</strong>
                  </div>
                ) : null}
                <div>
                  <span>Assigned Team</span>
                  <strong>{assignedTeamLabel}</strong>
                </div>
                {user?.userRole === UserRole.EMPLOYEE ? (
                  <div>
                    <span>Assigned By</span>
                    <strong>{detail.createdBy?.fullName ?? "N/A"}</strong>
                  </div>
                ) : null}
                <div>
                  <span>Priority</span>
                  <strong>{priorityLabelMap[detail.task.priority]}</strong>
                </div>
                <div>
                  <span>Due Date</span>
                  <strong>{toLocalDate(detail.task.dueDateUtc, taskTimeZone)}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{statusLabelMap[detail.task.status]}</strong>
                </div>
                <div>
                  <span>Count Based</span>
                  <strong>{detail.task.hasCountTracking ? "Yes" : "No"}</strong>
                </div>
                {detail.task.hasCountTracking ? (
                  <div>
                    <span>Benchmark / Count</span>
                    <strong>{detail.task.benchmarkMinutesPerCount ?? 0} mins</strong>
                  </div>
                ) : null}
                {detail.task.hasCountTracking ? (
                  <div>
                    <span>Count Number</span>
                    <strong>{detail.task.countNumber ?? 0}</strong>
                  </div>
                ) : null}
                <div>
                  <span>Created On</span>
                  <strong>{toLocalDate(detail.task.createdAt, taskTimeZone)}</strong>
                </div>
                <div>
                  <span>Start Time</span>
                  <strong className="task-date-time-cell">
                    <span>{startedAt.date}</span>
                    <span>{startedAt.time}</span>
                  </strong>
                </div>
                <div>
                  <span>End Time</span>
                  <strong className="task-date-time-cell">
                    <span>{completedAt.date}</span>
                    <span>{completedAt.time}</span>
                  </strong>
                </div>
              </section>

              <section className="task-drawer__progress-card">
                <div className="task-drawer__progress-header">
                  <div>
                    <span>Progress</span>
                    <strong>{completionPercent}% Complete</strong>
                  </div>
                  <div className="task-drawer__progress-metric">
                    <span>Logged / Estimated</span>
                    <strong>
                      {formatDuration(loggedSeconds)} / {formatDuration(estimatedSeconds)}
                    </strong>
                  </div>
                </div>
                {detail.task.hasCountTracking ? (
                  <div className="task-drawer__progress-metric task-drawer__progress-metric--left">
                    <span>Total Count Completed</span>
                    <strong>{detail.task.totalCountCompleted}</strong>
                  </div>
                ) : null}
                <div className="task-drawer__progress-track">
                  <div className="task-drawer__progress-fill" style={{ width: `${completionPercent}%` }} />
                </div>
              </section>

              <section className="task-drawer__timer-card">
                <span>Timer {runningEntry ? "Running" : "State"}</span>
                <div className="task-drawer__timer-row">
                  <strong>{runningEntry ? formatDuration(elapsedSeconds) : formatDuration(loggedSeconds)}</strong>
                  {canControlTimer || canRequestCompletion ? (
                    <div className="task-drawer__timer-actions">
                      {canControlTimer ? (
                        !runningEntry ? (
                          <LoadingButton className="timesheet-primary-button" loading={loadingAction === "timer-start"} onClick={() => void handleTimerAction("start")} type="button">
                            Start
                          </LoadingButton>
                        ) : (
                          <>
                            <LoadingButton
                              className="timesheet-secondary-button"
                              loading={loadingAction === "timer-pause"}
                              onClick={() => {
                                if (detail.task.hasCountTracking) {
                                  setPendingTimerAction("pause");
                                  setCountInput("");
                                  return;
                                }
                                void handleTimerAction("pause");
                              }}
                              type="button"
                            >
                              Pause
                            </LoadingButton>
                            <LoadingButton
                              className="timesheet-primary-button"
                              loading={loadingAction === "timer-stop"}
                              onClick={() => {
                                if (detail.task.hasCountTracking) {
                                  setPendingTimerAction("stop");
                                  setCountInput("");
                                  return;
                                }
                                void handleTimerAction("stop");
                              }}
                              type="button"
                            >
                              Stop
                            </LoadingButton>
                          </>
                        )
                      ) : null}
                      {canRequestCompletion ? (
                        <LoadingButton className="timesheet-secondary-button" loading={loadingAction === "completion-request"} onClick={() => void handleCompletionRequest()} type="button">
                          Mark Completed
                        </LoadingButton>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="task-drawer__description">
                <span>Task Description</span>
                <p>{detail.task.description}</p>
              </section>

              <section className="task-drawer__comments">
                <span>Comments</span>
                <div className="task-drawer__comment-list">
                    {detail.comments.map((comment) => {
                    const author = authorMap.get(comment.authorId);
                    const isCurrentUser = author?.id === user?.id;
                    const isEditing = editingCommentId === comment.id;
                    const isEdited =
                      new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 1000;

                    return (
                      <article key={comment.id} className="task-drawer__comment">
                        <div className="task-drawer__comment-header">
                          <strong>
                            {author?.fullName ?? "User"}{" "}
                            <span>
                              ({isCurrentUser ? "You" : author?.userRole === UserRole.MANAGER ? "Manager" : "User"})
                            </span>
                          </strong>
                          <div className="task-drawer__comment-meta">
                            <span>{formatDateTime(comment.createdAt)}</span>
                            {isEdited ? <span className="task-drawer__comment-edited">edited</span> : null}
                          </div>
                        </div>
                        {isEditing ? (
                          <>
                            <textarea
                              className="task-drawer__comment-input task-drawer__comment-input--inline"
                              rows={3}
                              value={editingCommentBody}
                              onChange={(event) => setEditingCommentBody(event.target.value)}
                            />
                            <div className="task-drawer__comment-actions task-drawer__comment-actions--inline">
                              <button
                                className="timesheet-secondary-button"
                                onClick={handleCommentEditCancel}
                                type="button"
                              >
                                Cancel
                              </button>
                              <LoadingButton
                                className="timesheet-primary-button"
                                loading={loadingAction === `comment-edit-${comment.id}`}
                                onClick={() => void handleCommentEditSave()}
                                type="button"
                              >
                                Save
                              </LoadingButton>
                            </div>
                          </>
                        ) : (
                          <>
                            <p>{comment.body}</p>
                            {isCurrentUser ? (
                              <div className="task-drawer__comment-actions task-drawer__comment-actions--inline">
                                <button
                                  className="task-drawer__comment-link"
                                  onClick={() => handleCommentEditStart(comment)}
                                  type="button"
                                >
                                  Edit
                                </button>
                              </div>
                            ) : null}
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
                <textarea
                  className="task-drawer__comment-input"
                  placeholder="Write a comment..."
                  rows={4}
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                />
                <div className="task-drawer__comment-actions">
                  <LoadingButton className="timesheet-secondary-button" loading={loadingAction === "comment-post"} onClick={() => void handleCommentSubmit()} type="button">
                    Post Comment
                  </LoadingButton>
                </div>
              </section>
              {approvals.length > 0 ? (
                <section className="task-drawer__approvals">
                  <span>Approval Updates</span>
                  <div className="task-drawer__approval-list">
                    {approvals.map((approval) => (
                      <article key={approval.id} className="task-drawer__approval">
                        <div className="task-drawer__approval-header">
                          <strong>{approvalTypeLabelMap[approval.type] ?? approval.type}</strong>
                          <span>{formatDateTime(approval.requestedAtUtc)}</span>
                        </div>
                        <p className="task-drawer__approval-status">
                          Status: {approval.status}
                        </p>
                        <p>{approval.reason}</p>
                        {approval.managerComment?.trim() ? (
                          <p className="task-drawer__approval-comment">
                            Manager Comment: {approval.managerComment}
                          </p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

            </div>
            {user?.userRole === UserRole.EMPLOYEE ? (
              <div className="task-drawer__footer">
                <button
                  className="task-drawer__footer-button"
                  onClick={() => setShowEditModal(true)}
                  type="button"
                >
                  Edit Task Details
                </button>
              </div>
            ) : null}
          </>
        )}
      </aside>
      {showEditModal && task ? (
        <div className="task-modal-overlay" onClick={() => setShowEditModal(false)} role="presentation">
          <div className="task-modal" onClick={(event) => event.stopPropagation()}>
            <div className="task-modal__header">
              <div>
                <h3>Edit Task Details</h3>
                <p>
                  {detail?.activity?.name ?? "Task"} - {detail?.project?.name ?? ""}
                </p>
              </div>
              <button className="task-modal__close" onClick={() => setShowEditModal(false)} type="button">
                ×
              </button>
            </div>
            <div className="task-modal__content">
              <div className="task-modal__field">
                <span>Status</span>
                <div className="task-modal__readonly">{statusLabelMap[task.status]}</div>
              </div>
              <div className="task-modal__field">
                <span>Due Date</span>
                <input
                  className="task-modal__input"
                  type="date"
                  value={requestedDueDate}
                  onChange={(event) => setRequestedDueDate(event.target.value)}
                />
              </div>
              <div className="task-modal__notice">
                Changing the due date will require Manager approval before the update takes effect.
              </div>
              <div className="task-modal__field">
                <span>Reason</span>
                <textarea
                  className="task-modal__textarea"
                  placeholder="Why should the due date change?"
                  rows={4}
                  value={requestReason}
                  onChange={(event) => setRequestReason(event.target.value)}
                />
              </div>
              <div className="task-modal__info">
                <div>
                  <span>Task Name</span>
                  <strong>{task.title}</strong>
                </div>
                <div>
                  <span>Project</span>
                  <strong>{detail?.project?.name ?? "N/A"}</strong>
                </div>
                <div>
                  <span>Activity</span>
                  <strong>{detail?.activity?.name ?? "N/A"}</strong>
                </div>
                <div>
                  <span>Assigned By</span>
                  <strong>{detail?.createdBy?.fullName ?? "N/A"}</strong>
                </div>
              </div>
            </div>
            <div className="task-modal__actions">
              <button className="timesheet-secondary-button" onClick={() => setShowEditModal(false)} type="button">
                Cancel
              </button>
              <LoadingButton className="timesheet-primary-button" loading={loadingAction === "due-date-request"} onClick={() => void handleDueDateRequest()} type="button">
                Save Changes
              </LoadingButton>
            </div>
          </div>
        </div>
      ) : null}
      {showSuccessModal && task ? (
        <div className="task-modal-overlay" onClick={() => setShowSuccessModal(false)} role="presentation">
          <div className="task-modal task-modal--compact" onClick={(event) => event.stopPropagation()}>
            <button
              className="task-modal__close task-modal__close--floating"
              onClick={() => setShowSuccessModal(false)}
              type="button"
            >
              ×
            </button>
            <div className="task-modal__success-icon">◔</div>
            <h3 className="task-modal__success-title">Approval Request Sent</h3>
            <p className="task-modal__success-copy">
              Your request to change the due date to {toLocalDate(requestedDueDate, taskTimeZone)} has been sent to{" "}
              {detail?.createdBy?.fullName ?? "your manager"} for approval. The date will update once approved.
            </p>
            <button
              className="timesheet-primary-button task-modal__done"
              onClick={() => setShowSuccessModal(false)}
              type="button"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
      {pendingTimerAction && task ? (
        <div className="task-modal-overlay" onClick={() => setPendingTimerAction(null)} role="presentation">
          <div className="task-modal task-modal--compact" onClick={(event) => event.stopPropagation()}>
            <button
              className="task-modal__close task-modal__close--floating"
              onClick={() => setPendingTimerAction(null)}
              type="button"
            >
              ×
            </button>
            <h3 className="task-modal__success-title">Enter Count</h3>
            <p className="task-modal__success-copy">
              Add the completed count for this session before you {pendingTimerAction === "pause" ? "pause" : "stop"} the timer.
            </p>
            <p className="task-modal__success-copy">
              Remaining count: {remainingCount} out of {task.countNumber ?? 0}
            </p>
            <input
              className="task-modal__input"
              min="0"
              max={remainingCount}
              step="1"
              type="number"
              value={countInput}
              onChange={(event) => setCountInput(event.target.value)}
            />
            <div className="task-modal__actions">
              <button className="timesheet-secondary-button" onClick={() => setPendingTimerAction(null)} type="button">
                Cancel
              </button>
              <LoadingButton
                className="timesheet-primary-button"
                loading={loadingAction === `timer-${pendingTimerAction}`}
                onClick={() => void handleCountActionConfirm()}
                type="button"
              >
                Confirm
              </LoadingButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
};
