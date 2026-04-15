import { Fragment, useEffect, useMemo, useState } from "react";

import {
  Priority,
  TaskStatus,
  toLocalDate,
  toLocalDateAndTimeParts,
  TimerState,
  type Activity,
  type Project,
  type Task,
  type Team,
  type TimeEntry,
  type User,
} from "@/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/features/auth/auth-context";
import { useDebounce } from "@/hooks/use-debounce";
import { TaskDetailDrawer } from "@/components/task-detail-drawer";

type ViewMode = "list" | "kanban";

type PaginatedTasksResponse = {
  items: Task[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

const PAGE_SIZE = 8;

const statusLabelMap: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: "Not Started",
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

const statusToneMap: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: "employee-task-pill employee-task-pill--neutral",
  [TaskStatus.WIP]: "employee-task-pill employee-task-pill--wip",
  [TaskStatus.ON_HOLD]: "employee-task-pill employee-task-pill--hold",
  [TaskStatus.APPROVAL_PENDING]:
    "employee-task-pill employee-task-pill--pending",
  [TaskStatus.REJECTED]: "employee-task-pill employee-task-pill--rejected",
  [TaskStatus.COMPLETED]: "employee-task-pill employee-task-pill--completed",
};

const formatDurationCompact = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (remainingSeconds > 0) {
    return [hours, minutes, remainingSeconds]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  }

  return [hours, minutes]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};

const buildQuery = (
  params: Record<string, string | number | boolean | undefined>,
) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  return searchParams.toString();
};

export const EmployeeTasksPage = () => {
  const { user } = useAuth();

  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [pagedTasks, setPagedTasks] = useState<PaginatedTasksResponse | null>(
    null,
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [expandedTaskDetails, setExpandedTaskDetails] = useState<Record<string, TaskDetailResponse>>({});
  const [expandedLoadingTaskId, setExpandedLoadingTaskId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchInput.trim(), 400);

  useEffect(() => {
    void Promise.all([
      api<Task[]>("/tasks"),
      api<Project[]>("/projects"),
      api<Activity[]>("/activities"),
      api<TimeEntry[]>("/time-tracking/entries"),
    ]).then(([tasksData, projectsData, activitiesData, entriesData]) => {
      setAllTasks(tasksData);
      setProjects(projectsData);
      setActivities(activitiesData);
      setEntries(entriesData);
    });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedProjectId, selectedStatus, selectedPriority]);

  useEffect(() => {
    const query = buildQuery({
      paginated: true,
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch || undefined,
      projectId: selectedProjectId || undefined,
      status: selectedStatus || undefined,
      priority: selectedPriority || undefined,
    });

    void api<PaginatedTasksResponse>(`/tasks?${query}`).then(setPagedTasks);
  }, [
    debouncedSearch,
    page,
    selectedPriority,
    selectedProjectId,
    selectedStatus,
  ]);

  const projectNameMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );
  const activityNameMap = useMemo(
    () => new Map(activities.map((activity) => [activity.id, activity.name])),
    [activities],
  );
  const loggedSecondsMap = useMemo(() => {
    const totals = new Map<string, number>();

    entries.forEach((entry) => {
      const seconds = entry.durationSeconds ?? entry.durationMinutes * 60;
      totals.set(entry.taskId, (totals.get(entry.taskId) ?? 0) + seconds);
    });

    return totals;
  }, [entries]);

  const summaryCards = useMemo(
    () => [
      { label: "Total Tasks", value: allTasks.length, status: "" },
      {
        label: "WIP",
        value: allTasks.filter((task) => task.status === TaskStatus.WIP).length,
        status: TaskStatus.WIP,
      },
      {
        label: "On Hold",
        value: allTasks.filter((task) => task.status === TaskStatus.ON_HOLD)
          .length,
        status: TaskStatus.ON_HOLD,
      },
      {
        label: "Completed",
        value: allTasks.filter((task) => task.status === TaskStatus.COMPLETED)
          .length,
        status: TaskStatus.COMPLETED,
      },
      {
        label: "Not Started",
        value: allTasks.filter((task) => task.status === TaskStatus.PENDING)
          .length,
        status: TaskStatus.PENDING,
      },
    ],
    [allTasks],
  );

  const kanbanGroups = useMemo(
    () =>
      [
        TaskStatus.PENDING,
        TaskStatus.WIP,
        TaskStatus.ON_HOLD,
        TaskStatus.APPROVAL_PENDING,
        TaskStatus.REJECTED,
        TaskStatus.COMPLETED,
      ].map((status) => ({
        status,
        label: statusLabelMap[status],
        tasks: (pagedTasks?.items ?? []).filter(
          (task) => task.status === status,
        ),
      })),
    [pagedTasks?.items],
  );

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
    if (assigneeEntries.some((entry) => entry.timerState === TimerState.RUNNING)) {
      return { label: "WIP", className: statusToneMap[TaskStatus.WIP] };
    }

    if (assigneeEntries.length === 0) {
      return { label: "Not Started", className: "employee-task-pill employee-task-pill--neutral" };
    }

    const latestEntry = [...assigneeEntries].sort(
      (left, right) =>
        new Date(right.endTimeUtc ?? right.startTimeUtc).getTime() -
        new Date(left.endTimeUtc ?? left.startTimeUtc).getTime(),
    )[0];

    if (task.status === TaskStatus.COMPLETED) {
      return { label: "Completed", className: statusToneMap[TaskStatus.COMPLETED] };
    }

    if (latestEntry?.timerState === TimerState.PAUSED) {
      return { label: "On Hold", className: statusToneMap[TaskStatus.ON_HOLD] };
    }

    return { label: "Stopped", className: "employee-task-pill employee-task-pill--pending" };
  };

  return (
    <div className="employee-tasks-page">
      <TaskDetailDrawer
        isOpen={Boolean(drawerTaskId)}
        onClose={() => setDrawerTaskId(null)}
        onTaskUpdated={async () => {
          const [tasksData, entriesData] = await Promise.all([
            api<Task[]>("/tasks"),
            api<TimeEntry[]>("/time-tracking/entries"),
          ]);

          setAllTasks(tasksData);
          setEntries(entriesData);

          const query = buildQuery({
            paginated: true,
            page,
            pageSize: PAGE_SIZE,
            search: debouncedSearch || undefined,
            projectId: selectedProjectId || undefined,
            status: selectedStatus || undefined,
            priority: selectedPriority || undefined,
          });

          setPagedTasks(await api<PaginatedTasksResponse>(`/tasks?${query}`));
        }}
        taskId={drawerTaskId}
      />
      <div className="employee-tasks-toolbar">
        <div className="employee-tasks-count">
          {allTasks.length} tasks assigned
        </div>
        <div className="employee-tasks-controls">
          <label className="employee-tasks-search">
            <span className="employee-tasks-search__icon">⌕</span>
            <input
              type="search"
              placeholder="Search task, project, activity"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
          >
            <option value="">All Project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value)}
          >
            <option value="">All Status</option>
            {Object.values(TaskStatus).map((status) => (
              <option key={status} value={status}>
                {statusLabelMap[status]}
              </option>
            ))}
          </select>
          <select
            value={selectedPriority}
            onChange={(event) => setSelectedPriority(event.target.value)}
          >
            <option value="">All Priority</option>
            {Object.values(Priority).map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabelMap[priority]}
              </option>
            ))}
          </select>
          <div className="employee-tasks-view-toggle">
            <button
              className={viewMode === "list" ? "is-active" : ""}
              onClick={() => setViewMode("list")}
              type="button"
            >
              List
            </button>
            <button
              className={viewMode === "kanban" ? "is-active" : ""}
              onClick={() => setViewMode("kanban")}
              type="button"
            >
              Kanban
            </button>
          </div>
        </div>
      </div>

      <section className="employee-tasks-summary">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className={`employee-tasks-summary__card ${selectedStatus === card.status ? "is-active" : ""}`}
            onClick={() => setSelectedStatus(card.status)}
          >
            <span>{card.label}</span>
            <strong>{String(card.value).padStart(2, "0")}</strong>
          </article>
        ))}
      </section>

      {viewMode === "list" ? (
        <section className="employee-task-table-card">
          <table className="employee-task-table">
            <thead>
              <tr>
                <th>S. N</th>
                <th>Task Name</th>
                <th>Project</th>
                <th>Activity</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assign By</th>
                <th>Due Date</th>
                <th className="employee-task-table__time-column">Start Time</th>
                <th className="employee-task-table__time-column">End Time</th>
                <th>Est. Hours</th>
                <th>Logged</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(pagedTasks?.items ?? []).map((task, index) => {
                const startedAt = toLocalDateAndTimeParts(
                  task.startedAtUtc,
                  user?.timezone,
                );
                const completedAt = toLocalDateAndTimeParts(
                  task.completedAtUtc,
                  user?.timezone,
                );
                const detail = expandedTaskDetails[task.id];
                const isExpanded = expandedTaskId === task.id;

                return (
                  <Fragment key={task.id}>
                    <tr
                      className={`employee-task-table__row ${isExpanded ? "manager-task-row--expanded" : ""}`}
                      onClick={() => void toggleExpandedTask(task.id)}
                    >
                      <td>
                        {String((page - 1) * PAGE_SIZE + index + 1).padStart(
                          2,
                          "0",
                        )}
                      </td>
                      <td className="employee-task-table__strong">
                        {task.title}
                      </td>
                      <td>
                        {projectNameMap.get(task.projectId) ?? task.projectId}
                      </td>
                      <td>
                        {activityNameMap.get(task.activityId) ?? task.activityId}
                      </td>
                      <td>{priorityLabelMap[task.priority]}</td>
                      <td>
                        <span className={statusToneMap[task.status]}>
                          {statusLabelMap[task.status]}
                        </span>
                      </td>
                      <td>{user?.fullName ?? "Assigned User"}</td>
                      <td>{toLocalDate(task.dueDateUtc, user?.timezone)}</td>
                      <td className="employee-task-table__time-column">
                        <div className="task-date-time-cell">
                          <span>{startedAt.date}</span>
                          <span>{startedAt.time}</span>
                        </div>
                      </td>
                      <td className="employee-task-table__time-column">
                        <div className="task-date-time-cell">
                          <span>{completedAt.date}</span>
                          <span>{completedAt.time}</span>
                        </div>
                      </td>
                      <td>{task.estimatedHours.toFixed(2)}</td>
                      <td>
                        {formatDurationCompact(
                          loggedSecondsMap.get(task.id) ?? 0,
                        )}
                      </td>
                      <td>
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
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="manager-task-expand-row">
                        <td colSpan={13}>
                          <div className="manager-task-expand-card">
                            {expandedLoadingTaskId === task.id && !detail ? (
                              <p className="manager-dashboard-inactive">Loading task details...</p>
                            ) : detail ? (
                              <>
                                <div className="manager-task-expand-meta">
                                  <div>
                                    <span>Assignment</span>
                                    <strong>
                                      {detail.assignedTeams.length > 0
                                        ? `Team: ${detail.assignedTeams.map((team) => team.name).join(", ")}`
                                        : "Direct Employee Assignment"}
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
                                    <strong>{detail.createdBy?.fullName ?? "N/A"}</strong>
                                  </div>
                                </div>
                                <div className="manager-task-expand-description">
                                  <span>Description</span>
                                  <p>{detail.task.description}</p>
                                </div>
                                <div className="manager-task-assignee-block">
                                  <div className="manager-task-assignee-block__header">
                                    <h4>Employee Status</h4>
                                    <p>Task progress details for each assigned employee</p>
                                  </div>
                                  <div className="manager-task-assignee-grid">
                                    {detail.assignees.map((assignee) => {
                                      const assigneeEntries = detail.entries.filter((entry) => entry.employeeId === assignee.id);
                                      const totalLoggedSeconds = assigneeEntries.reduce(
                                        (sum, entry) => sum + (entry.durationSeconds ?? entry.durationMinutes * 60),
                                        0,
                                      );
                                      const totalCountCompleted = assigneeEntries.reduce(
                                        (sum, entry) => sum + (entry.countCompleted ?? 0),
                                        0,
                                      );
                                      const firstStartedAt = assigneeEntries.map((entry) => entry.startTimeUtc).sort()[0];
                                      const lastEndedAt = assigneeEntries
                                        .map((entry) => entry.endTimeUtc ?? entry.startTimeUtc)
                                        .sort()
                                        .at(-1);
                                      const assigneeStatus = getAssigneeStatus(detail.task, assigneeEntries);
                                      const firstStarted = toLocalDateAndTimeParts(firstStartedAt, assignee.timezone);
                                      const lastEnded = toLocalDateAndTimeParts(lastEndedAt, assignee.timezone);

                                      return (
                                        <article key={assignee.id} className="manager-task-assignee-card">
                                          <div className="manager-task-assignee-card__top">
                                            <div>
                                              <strong>{assignee.fullName}</strong>
                                              <span>{assignee.email}</span>
                                            </div>
                                            <span className={assigneeStatus.className}>{assigneeStatus.label}</span>
                                          </div>
                                          <div className="manager-task-assignee-card__metrics">
                                            <div>
                                              <span>Logged</span>
                                              <strong>{formatDurationCompact(totalLoggedSeconds)}</strong>
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
                                                <strong>{totalCountCompleted}</strong>
                                              </div>
                                            ) : null}
                                            <div>
                                              <span>Sessions</span>
                                              <strong>{assigneeEntries.length}</strong>
                                            </div>
                                          </div>
                                        </article>
                                      );
                                    })}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <p className="manager-dashboard-inactive">Task details could not be loaded.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {(pagedTasks?.items.length ?? 0) === 0 ? (
                <tr>
                  <td className="employee-task-table__empty" colSpan={13}>
                    No tasks matched the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="employee-kanban-board">
          {kanbanGroups.map((group) => (
            <article key={group.status} className="employee-kanban-column">
              <header>
                <h3>{group.label}</h3>
                <span>{group.tasks.length}</span>
              </header>
              <div className="employee-kanban-column__body">
                {group.tasks.length > 0 ? (
                  group.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="employee-kanban-card"
                      onClick={() => setDrawerTaskId(task.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setDrawerTaskId(task.id);
                        }
                      }}
                    >
                      <strong>{task.title}</strong>
                      <p>
                        {projectNameMap.get(task.projectId) ?? task.projectId}
                      </p>
                      <p>
                        {activityNameMap.get(task.activityId) ??
                          task.activityId}
                      </p>
                      <div className="employee-kanban-card__meta">
                        <span>{priorityLabelMap[task.priority]}</span>
                        <span>
                          {formatDurationCompact(
                            loggedSecondsMap.get(task.id) ?? 0,
                          )}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="employee-kanban-empty">No tasks</div>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      <div className="employee-tasks-footer">
        <span>
          Showing{" "}
          {(pagedTasks?.items.length ?? 0) === 0
            ? 0
            : (page - 1) * PAGE_SIZE + 1}
          -{(page - 1) * PAGE_SIZE + (pagedTasks?.items.length ?? 0)} of{" "}
          {pagedTasks?.total ?? 0} tasks
        </span>
        <div className="employee-tasks-pagination">
          <button
            disabled={(pagedTasks?.page ?? 1) <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            ‹
          </button>
          {Array.from(
            { length: pagedTasks?.totalPages ?? 1 },
            (_, index) => index + 1,
          ).map((pageNumber) => (
            <button
              key={pageNumber}
              className={
                pageNumber === (pagedTasks?.page ?? 1) ? "is-active" : ""
              }
              onClick={() => setPage(pageNumber)}
              type="button"
            >
              {pageNumber}
            </button>
          ))}
          <button
            disabled={(pagedTasks?.page ?? 1) >= (pagedTasks?.totalPages ?? 1)}
            onClick={() =>
              setPage((current) =>
                Math.min(pagedTasks?.totalPages ?? current, current + 1),
              )
            }
            type="button"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
};
