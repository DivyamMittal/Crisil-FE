import { useEffect, useMemo, useState } from "react";

import {
  Priority,
  TaskStatus,
  toLocalDate,
  toLocalDateAndTimeParts,
  type Activity,
  type Project,
  type Task,
  type TimeEntry,
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
      { label: "Total Tasks", value: allTasks.length },
      {
        label: "WIP",
        value: allTasks.filter((task) => task.status === TaskStatus.WIP).length,
      },
      {
        label: "On Hold",
        value: allTasks.filter((task) => task.status === TaskStatus.ON_HOLD)
          .length,
      },
      {
        label: "Completed",
        value: allTasks.filter((task) => task.status === TaskStatus.COMPLETED)
          .length,
      },
      {
        label: "Not Started",
        value: allTasks.filter((task) => task.status === TaskStatus.PENDING)
          .length,
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
              placeholder="Search Tasks"
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
          <article key={card.label} className="employee-tasks-summary__card">
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

                return (
                  <tr
                    key={task.id}
                    className="employee-task-table__row"
                    onClick={() => setDrawerTaskId(task.id)}
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
                  </tr>
                );
              })}
              {(pagedTasks?.items.length ?? 0) === 0 ? (
                <tr>
                  <td className="employee-task-table__empty" colSpan={12}>
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
