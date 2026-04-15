import { Fragment, useEffect, useMemo, useState } from "react";

import { TaskDetailDrawer } from "@/components/task-detail-drawer";
import { useDebounce } from "@/hooks/use-debounce";
import { api } from "@/lib/api";
import {
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

const PAGE_SIZE = 8;

const statusLabelMap: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: "Pending",
  [TaskStatus.WIP]: "WIP",
  [TaskStatus.ON_HOLD]: "On Hold",
  [TaskStatus.APPROVAL_PENDING]: "Approval Pending",
  [TaskStatus.REJECTED]: "Rejected",
  [TaskStatus.COMPLETED]: "Completed",
};

const statusToneMap: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: "employee-task-pill employee-task-pill--neutral",
  [TaskStatus.WIP]: "employee-task-pill employee-task-pill--wip",
  [TaskStatus.ON_HOLD]: "employee-task-pill employee-task-pill--hold",
  [TaskStatus.APPROVAL_PENDING]: "employee-task-pill employee-task-pill--pending",
  [TaskStatus.REJECTED]: "employee-task-pill employee-task-pill--rejected",
  [TaskStatus.COMPLETED]: "employee-task-pill employee-task-pill--completed",
};

type Period = "today" | "week" | "month";

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

const formatDurationCompact = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (remainingSeconds > 0) {
    return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, "0")).join(":");
  }

  return [hours, minutes].map((value) => String(value).padStart(2, "0")).join(":");
};

const getPeriodRange = (period: Period, offset: number) => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + offset);
    end.setTime(start.getTime());
    end.setHours(23, 59, 59, 999);
  } else if (period === "week") {
    const dayOfWeek = start.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + mondayOffset + offset * 7);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setHours(0, 0, 0, 0);
    start.setDate(1);
    start.setMonth(start.getMonth() + offset);
    end.setTime(start.getTime());
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
};

const formatPeriodLabel = (period: Period, start: Date, end: Date) => {
  if (period === "today") {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(start);
  }

  if (period === "week") {
    const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
    const dayFormatter = new Intl.DateTimeFormat("en-US", { day: "2-digit" });
    const yearFormatter = new Intl.DateTimeFormat("en-US", { year: "numeric" });

    return `${monthFormatter.format(start).toUpperCase()} ${dayFormatter.format(start)} - ${monthFormatter
      .format(end)
      .toUpperCase()} ${dayFormatter.format(end)}, ${yearFormatter.format(end)}`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(start);
};

const isDateInRange = (value: string | null | undefined, start: Date, end: Date) => {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  return date >= start && date <= end;
};

const matchesTaskPeriod = (task: Task, start: Date, end: Date) =>
  task.status === TaskStatus.WIP ||
  task.status === TaskStatus.ON_HOLD ||
  [
    task.createdAt,
    task.updatedAt,
    task.startedAtUtc,
    task.completedAtUtc,
    task.dueDateUtc,
  ].some((value) => isDateInRange(value, start, end));

export const ManagerTasksPage = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState(1);
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [expandedTaskDetails, setExpandedTaskDetails] = useState<Record<string, TaskDetailResponse>>({});
  const [expandedLoadingTaskId, setExpandedLoadingTaskId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchInput.trim(), 400);

  const load = async () => {
    const [tasksData, projectsData, activitiesData, employeesData, entriesData] = await Promise.all([
      api<Task[]>("/tasks"),
      api<Project[]>("/projects"),
      api<Activity[]>("/activities"),
      api<User[]>("/users?scope=team&role=EMPLOYEE"),
      api<TimeEntry[]>("/time-tracking/entries"),
    ]);

    setTasks(tasksData);
    setProjects(projectsData);
    setActivities(activitiesData);
    setEmployees(employeesData);
    setEntries(entriesData);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedProjectId, selectedActivityId, selectedStatus, period, offset]);

  const projectNameMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );
  const activityNameMap = useMemo(
    () => new Map(activities.map((activity) => [activity.id, activity.name])),
    [activities],
  );
  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );
  const loggedSecondsMap = useMemo(() => {
    const totals = new Map<string, number>();

    entries.forEach((entry) => {
      const seconds = entry.durationSeconds ?? entry.durationMinutes * 60;
      totals.set(entry.taskId, (totals.get(entry.taskId) ?? 0) + seconds);
    });

    return totals;
  }, [entries]);

  const { start, end } = useMemo(() => getPeriodRange(period, offset), [period, offset]);
  const periodLabel = useMemo(() => formatPeriodLabel(period, start, end), [period, start, end]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesPeriod = matchesTaskPeriod(task, start, end);
      const matchesProject = !selectedProjectId || task.projectId === selectedProjectId;
      const matchesActivity = !selectedActivityId || task.activityId === selectedActivityId;
      const matchesStatus = !selectedStatus || task.status === selectedStatus;

      const searchTerm = debouncedSearch.toLowerCase();
      const projectName = (projectNameMap.get(task.projectId) ?? "").toLowerCase();
      const activityName = (activityNameMap.get(task.activityId) ?? "").toLowerCase();
      const taskTitle = task.title.toLowerCase();
      const matchesSearch =
        searchTerm.length === 0 ||
        projectName.includes(searchTerm) ||
        activityName.includes(searchTerm) ||
        taskTitle.includes(searchTerm);

      return matchesPeriod && matchesProject && matchesActivity && matchesStatus && matchesSearch;
    });
  }, [
    activityNameMap,
    debouncedSearch,
    end,
    projectNameMap,
    selectedActivityId,
    selectedProjectId,
    selectedStatus,
    start,
    tasks,
  ]);

  const summaryCards = useMemo(
    () => [
      { label: "Total Tasks", value: filteredTasks.length, status: "" },
      {
        label: "Completed",
        value: tasks.filter((task) => task.status === TaskStatus.COMPLETED)
          .length,
        status: TaskStatus.COMPLETED,
      },
      {
        label: "WIP",
        value: tasks.filter((task) => task.status === TaskStatus.WIP).length,
        status: TaskStatus.WIP,
      },
      {
        label: "On Hold",
        value: tasks.filter((task) => task.status === TaskStatus.ON_HOLD).length,
        status: TaskStatus.ON_HOLD,
      },
    ],
    [filteredTasks.length, tasks],
  );

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const pagedTasks = filteredTasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

  const getAssigneeStatus = (task: Task, employeeEntries: TimeEntry[]) => {
    if (employeeEntries.some((entry) => entry.timerState === TimerState.RUNNING)) {
      return { label: "WIP", className: statusToneMap[TaskStatus.WIP] };
    }

    if (employeeEntries.length === 0) {
      return { label: "Not Started", className: "employee-task-pill employee-task-pill--neutral" };
    }

    const latestEntry = [...employeeEntries].sort(
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
        onTaskUpdated={load}
        taskId={drawerTaskId}
      />

      <div className="timesheet-section-header">
        <div className="timesheet-header-copy">
          <h2>Task Tracker</h2>
          <p>{periodLabel}</p>
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
                {option === "today" ? "Today" : option === "week" ? "Weekly" : "Monthly"}
              </button>
            ))}
          </div>
          <div className="manager-week-switcher">
            <button onClick={() => setOffset((current) => current - 1)} type="button">
              ‹ Prev
            </button>
            <strong>{periodLabel}</strong>
            <button disabled={offset === 0} onClick={() => setOffset((current) => Math.min(0, current + 1))} type="button">
              Next ›
            </button>
          </div>
        </div>
      </div>

      <div className="employee-tasks-toolbar">
        <div className="employee-tasks-count">{filteredTasks.length} tasks in view</div>
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
          <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
            <option value="">All Project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select value={selectedActivityId} onChange={(event) => setSelectedActivityId(event.target.value)}>
            <option value="">All Activity</option>
            {activities
              .filter((activity) => !selectedProjectId || activity.projectId === selectedProjectId)
              .map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                </option>
              ))}
          </select>
          <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
            <option value="">All Status</option>
            {Object.values(TaskStatus).map((status) => (
              <option key={status} value={status}>
                {statusLabelMap[status]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="employee-tasks-summary employee-tasks-summary--four">
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

      <section className="employee-task-table-card">
        <table className="employee-task-table">
          <thead>
            <tr>
              <th>S. N</th>
              <th>Task Name</th>
              <th>Project</th>
              <th>Activity</th>
              <th>Assigned To</th>
              <th>Status</th>
              <th>Due Date</th>
              <th className="employee-task-table__time-column">Start Time</th>
              <th className="employee-task-table__time-column">End Time</th>
              <th>Est. Hours</th>
              <th>Logged</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pagedTasks.map((task, index) => {
              const assigneeIds = task.assigneeIds?.length ? task.assigneeIds : [task.assigneeId];
              const assignees = assigneeIds.map((assigneeId) => employeeMap.get(assigneeId)).filter(Boolean);
              const primaryAssignee = assignees[0];
              const startedAt = toLocalDateAndTimeParts(task.startedAtUtc, primaryAssignee?.timezone);
              const completedAt = toLocalDateAndTimeParts(task.completedAtUtc, primaryAssignee?.timezone);
              const detail = expandedTaskDetails[task.id];
              const isExpanded = expandedTaskId === task.id;

              return (
                <Fragment key={task.id}>
                  <tr
                    className={`employee-task-table__row ${isExpanded ? "manager-task-row--expanded" : ""}`}
                    onClick={() => void toggleExpandedTask(task.id)}
                  >
                    <td>{String((page - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}</td>
                    <td className="employee-task-table__strong">{task.title}</td>
                    <td>{projectNameMap.get(task.projectId) ?? task.projectId}</td>
                    <td>{activityNameMap.get(task.activityId) ?? task.activityId}</td>
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
                    <td>
                      <span className={statusToneMap[task.status]}>{statusLabelMap[task.status]}</span>
                    </td>
                    <td>{toLocalDate(task.dueDateUtc, primaryAssignee?.timezone)}</td>
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
                    <td>{formatDurationCompact(loggedSecondsMap.get(task.id) ?? 0)}</td>
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
                      <td colSpan={12}>
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
                                  <p>
                                    {detail.assignedTeams.length > 0
                                      ? "Team assignment details for each employee"
                                      : "Task progress details for each assigned employee"}
                                  </p>
                                </div>
                                <div className="manager-task-assignee-grid">
                                  {detail.assignees.map((assignee) => {
                                    const employeeEntries = detail.entries.filter((entry) => entry.employeeId === assignee.id);
                                    const totalLoggedSeconds = employeeEntries.reduce(
                                      (sum, entry) => sum + (entry.durationSeconds ?? entry.durationMinutes * 60),
                                      0,
                                    );
                                    const totalCountCompleted = employeeEntries.reduce(
                                      (sum, entry) => sum + (entry.countCompleted ?? 0),
                                      0,
                                    );
                                    const firstStartedAt = employeeEntries
                                      .map((entry) => entry.startTimeUtc)
                                      .sort()[0];
                                    const lastEndedAt = employeeEntries
                                      .map((entry) => entry.endTimeUtc ?? entry.startTimeUtc)
                                      .sort()
                                      .at(-1);
                                    const employeeStatus = getAssigneeStatus(detail.task, employeeEntries);
                                    const firstStarted = toLocalDateAndTimeParts(firstStartedAt, assignee.timezone);
                                    const lastEnded = toLocalDateAndTimeParts(lastEndedAt, assignee.timezone);

                                    return (
                                      <article key={assignee.id} className="manager-task-assignee-card">
                                        <div className="manager-task-assignee-card__top">
                                          <div>
                                            <strong>{assignee.fullName}</strong>
                                            <span>{assignee.email}</span>
                                          </div>
                                          <span className={employeeStatus.className}>{employeeStatus.label}</span>
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
                                            <strong>{employeeEntries.length}</strong>
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
            {pagedTasks.length === 0 ? (
              <tr>
                <td className="employee-task-table__empty" colSpan={12}>
                  No tasks matched the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div className="employee-tasks-footer">
        <span>
          Showing {pagedTasks.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-
          {(page - 1) * PAGE_SIZE + pagedTasks.length} of {filteredTasks.length} tasks
        </span>
        <div className="employee-tasks-pagination">
          <button disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              className={pageNumber === page ? "is-active" : ""}
              onClick={() => setPage(pageNumber)}
              type="button"
            >
              {pageNumber}
            </button>
          ))}
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            type="button"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
};
