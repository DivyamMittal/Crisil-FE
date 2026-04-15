import { useEffect, useState } from "react";

import {
  Priority,
  ProjectStatus,
  TaskStatus,
  toLocalDate,
  toLocalDateAndTimeParts,
  type Task,
  type Team,
  type User,
} from "@/shared";
import { LoadingButton } from "@/components/loading-button";
import { Card, SectionTitle } from "@/ui";
import { api } from "@/lib/api";
import { showSuccessToast } from "@/lib/toast";
import { TaskDetailDrawer } from "@/components/task-detail-drawer";

type Project = {
  id: string;
  code: string;
  name: string;
  description: string;
};

type Activity = {
  id: string;
  projectId: string;
  name: string;
  description: string;
};

const taskStatusLabelMap: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: "Pending",
  [TaskStatus.WIP]: "WIP",
  [TaskStatus.ON_HOLD]: "On Hold",
  [TaskStatus.APPROVAL_PENDING]: "Approval Pending",
  [TaskStatus.REJECTED]: "Rejected",
  [TaskStatus.COMPLETED]: "Completed",
};

export const ManagerProjectsPage = () => {
  const [estimatedHoursUnit, setEstimatedHoursUnit] = useState<"HOUR" | "MIN">("HOUR");
  const [benchmarkUnit, setBenchmarkUnit] = useState<"HOUR" | "MIN">("MIN");
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [projectForm, setProjectForm] = useState({
    code: "",
    name: "",
    description: "",
    status: ProjectStatus.ACTIVE,
    startDateUtc: new Date().toISOString(),
    targetEndDateUtc: new Date(Date.now() + 7 * 86400000).toISOString(),
  });
  const [activityForm, setActivityForm] = useState({
    projectId: "",
    name: "",
    description: "",
    status: ProjectStatus.ACTIVE,
  });
  const [taskForm, setTaskForm] = useState({
    projectId: "",
    activityId: "",
    title: "",
    description: "",
    assignmentType: "EMPLOYEE" as "EMPLOYEE" | "TEAM",
    assignedTeamId: "",
    assigneeIds: [] as string[],
    assigneeId: "",
    priority: Priority.MEDIUM,
    estimatedHours: 8,
    hasCountTracking: false,
    countNumber: 1,
    benchmarkMinutesPerCount: 30,
    dueDateUtc: new Date(Date.now() + 2 * 86400000).toISOString(),
  });
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const [submittingSection, setSubmittingSection] = useState<"project" | "activity" | "task" | null>(null);
  const knownEmployees = [
    ...new Map(
      [...employees, ...teams.flatMap((team) => team.members ?? [])].map((employee) => [employee.id, employee]),
    ).values(),
  ];
  const activeEmployees = knownEmployees.filter((employee) => employee.isActive);

  const load = async () => {
    const [projectsData, activitiesData, tasksData, employeesData, teamsData] = await Promise.all([
      api<Project[]>("/projects"),
      api<Activity[]>("/activities"),
      api<Task[]>("/tasks"),
      api<User[]>("/users?scope=team&role=EMPLOYEE"),
      api<Team[]>("/teams?scope=all"),
    ]);

    setProjects(projectsData);
    setActivities(activitiesData);
    setTasks(tasksData);
    setEmployees(employeesData);
    setTeams(teamsData);
  };

  useEffect(() => {
    void load();
  }, []);

  const benchmarkValue =
    benchmarkUnit === "HOUR"
      ? taskForm.benchmarkMinutesPerCount / 60
      : taskForm.benchmarkMinutesPerCount;
  const calculatedEstimatedMinutes = taskForm.hasCountTracking
    ? taskForm.countNumber * taskForm.benchmarkMinutesPerCount
    : taskForm.estimatedHours * 60;
  const estimatedHoursDisplayValue =
    estimatedHoursUnit === "HOUR"
      ? Number((calculatedEstimatedMinutes / 60).toFixed(2))
      : calculatedEstimatedMinutes;

  return (
    <div className="manager-dashboard-page">
      <TaskDetailDrawer
        isOpen={Boolean(drawerTaskId)}
        onClose={() => setDrawerTaskId(null)}
        onTaskUpdated={load}
        taskId={drawerTaskId}
      />
      <SectionTitle title="Projects, Activities, Tasks" subtitle="Create project structures, activities, and assign tasks to your team." />

      <div className="manager-workspace-grid">
      <Card title="Create Project">
        <form
          className="form-grid form-grid--two"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmittingSection("project");
            try {
              await api("/projects", { method: "POST", body: JSON.stringify(projectForm), suppressGlobalLoader: true });
              showSuccessToast("Project created successfully");
              setProjectForm((current) => ({ ...current, code: "", name: "", description: "" }));
              await load();
            } finally {
              setSubmittingSection(null);
            }
          }}
        >
          <label className="field">
            <span className="manager-form-label">Project Code</span>
            <input className="input" placeholder="CRD-BFSI" value={projectForm.code} onChange={(e) => setProjectForm((current) => ({ ...current, code: e.target.value }))} />
          </label>
          <label className="field">
            <span className="manager-form-label">Project Name</span>
            <input className="input" placeholder="Credit Rating - BFSI" value={projectForm.name} onChange={(e) => setProjectForm((current) => ({ ...current, name: e.target.value }))} />
          </label>
          <label className="field field--full">
            <span className="manager-form-label">Description</span>
            <textarea className="input textarea" placeholder="Enter project scope and summary" value={projectForm.description} onChange={(e) => setProjectForm((current) => ({ ...current, description: e.target.value }))} />
          </label>
          <div className="manager-form-actions manager-form-actions--full">
            <LoadingButton className="timesheet-primary-button" loading={submittingSection === "project"} type="submit">Create Project</LoadingButton>
          </div>
        </form>
      </Card>

      <Card title="Create Activity">
        <form
          className="form-grid form-grid--two"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmittingSection("activity");
            try {
              await api("/activities", { method: "POST", body: JSON.stringify(activityForm), suppressGlobalLoader: true });
              showSuccessToast("Activity created successfully");
              setActivityForm((current) => ({ ...current, name: "", description: "" }));
              await load();
            } finally {
              setSubmittingSection(null);
            }
          }}
        >
          <label className="field">
            <span className="manager-form-label">Project</span>
            <select className="input" value={activityForm.projectId} onChange={(e) => setActivityForm((current) => ({ ...current, projectId: e.target.value }))}>
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="manager-form-label">Activity Name</span>
            <input className="input" placeholder="Financial Modelling" value={activityForm.name} onChange={(e) => setActivityForm((current) => ({ ...current, name: e.target.value }))} />
          </label>
          <label className="field field--full">
            <span className="manager-form-label">Description</span>
            <textarea className="input textarea" placeholder="Enter activity description" value={activityForm.description} onChange={(e) => setActivityForm((current) => ({ ...current, description: e.target.value }))} />
          </label>
          <div className="manager-form-actions manager-form-actions--full">
            <LoadingButton className="timesheet-primary-button" loading={submittingSection === "activity"} type="submit">Create Activity</LoadingButton>
          </div>
        </form>
      </Card>
      </div>

      <Card title="Create Task">
        <form
          className="form-grid form-grid--two"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmittingSection("task");
            try {
              const payload = {
                ...taskForm,
                assigneeIds:
                  taskForm.assignmentType === "EMPLOYEE"
                    ? taskForm.hasCountTracking
                      ? taskForm.assigneeIds
                      : [taskForm.assigneeId]
                    : [],
                assignedTeamIds:
                  taskForm.assignmentType === "TEAM" && taskForm.assignedTeamId
                    ? [taskForm.assignedTeamId]
                    : [],
                countNumber: taskForm.hasCountTracking ? taskForm.countNumber : null,
                benchmarkMinutesPerCount: taskForm.hasCountTracking ? taskForm.benchmarkMinutesPerCount : null,
                estimatedHours: taskForm.hasCountTracking
                  ? calculatedEstimatedMinutes / 60
                  : estimatedHoursUnit === "HOUR"
                    ? taskForm.estimatedHours
                    : taskForm.estimatedHours / 60,
              };
              await api("/tasks", { method: "POST", body: JSON.stringify(payload), suppressGlobalLoader: true });
              showSuccessToast("Task created successfully");
              setTaskForm((current) => ({
                ...current,
                title: "",
                description: "",
                assignmentType: "EMPLOYEE",
                assignedTeamId: "",
                assigneeIds: [],
                assigneeId: "",
                hasCountTracking: false,
                countNumber: 1,
                benchmarkMinutesPerCount: 30,
              }));
              setAssigneeDropdownOpen(false);
              await load();
            } finally {
              setSubmittingSection(null);
            }
          }}
        >
          <label className="field">
            <span className="manager-form-label">Project</span>
            <select className="input" value={taskForm.projectId} onChange={(e) => setTaskForm((current) => ({ ...current, projectId: e.target.value }))}>
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="manager-form-label">Activity</span>
            <select className="input" value={taskForm.activityId} onChange={(e) => setTaskForm((current) => ({ ...current, activityId: e.target.value }))}>
              <option value="">Select activity</option>
              {activities
                .filter((activity) => !taskForm.projectId || activity.projectId === taskForm.projectId)
                .map((activity) => (
                  <option key={activity.id} value={activity.id}>{activity.name}</option>
                ))}
            </select>
          </label>
          <label className="field">
            <span className="manager-form-label">Task Title</span>
            <input className="input" placeholder="Model Audit" value={taskForm.title} onChange={(e) => setTaskForm((current) => ({ ...current, title: e.target.value }))} />
          </label>
          <label className="field field--full">
            <span className="manager-form-label">Task Description</span>
            <textarea className="input textarea" placeholder="Enter task description" value={taskForm.description} onChange={(e) => setTaskForm((current) => ({ ...current, description: e.target.value }))} />
          </label>
          <label className="field">
            <span className="manager-form-label">Priority</span>
            <select className="input" value={taskForm.priority} onChange={(e) => setTaskForm((current) => ({ ...current, priority: e.target.value as Priority }))}>
              {Object.values(Priority).map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="manager-form-label">Estimated Hours</span>
            <div className="manager-unit-field">
              <input
                className="input"
                min="0.25"
                readOnly={taskForm.hasCountTracking}
                type="number"
                value={estimatedHoursDisplayValue}
                onChange={(e) => setTaskForm((current) => ({ ...current, estimatedHours: Number(e.target.value) }))}
              />
              <div className="employee-tasks-view-toggle manager-unit-toggle">
                <button className={estimatedHoursUnit === "HOUR" ? "is-active" : ""} onClick={() => setEstimatedHoursUnit("HOUR")} type="button">
                  Hour
                </button>
                <button className={estimatedHoursUnit === "MIN" ? "is-active" : ""} onClick={() => setEstimatedHoursUnit("MIN")} type="button">
                  Min
                </button>
              </div>
            </div>
          </label>
          <label className="field">
            <span className="manager-form-label">Assign To</span>
            <select
              className="input"
              value={taskForm.assignmentType}
              onChange={(e) =>
                setTaskForm((current) => ({
                  ...current,
                  assignmentType: e.target.value as "EMPLOYEE" | "TEAM",
                  assignedTeamId: "",
                  assigneeId: "",
                  assigneeIds: [],
                }))
              }
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="TEAM">Team</option>
            </select>
          </label>
          <label className="field">
            <span className="manager-form-label">Count Based Task</span>
            <select
              className="input"
              value={taskForm.hasCountTracking ? "YES" : "NO"}
              onChange={(e) =>
                setTaskForm((current) => ({
                  ...current,
                  hasCountTracking: e.target.value === "YES",
                  assigneeIds:
                    current.assignmentType === "EMPLOYEE" && e.target.value === "YES"
                      ? current.assigneeIds
                      : [],
                }))
              }
            >
              <option value="NO">No</option>
              <option value="YES">Yes</option>
            </select>
          </label>
          {taskForm.hasCountTracking ? (
            <>
              <label className="field">
                <span className="manager-form-label">Count Number</span>
                <input
                  className="input"
                  min="1"
                  type="number"
                  value={taskForm.countNumber}
                  onChange={(e) =>
                    setTaskForm((current) => ({
                      ...current,
                      countNumber: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="field">
                <span className="manager-form-label">Benchmark / Count</span>
                <div className="manager-unit-field">
                  <input
                    className="input"
                    min="1"
                    type="number"
                    value={benchmarkValue}
                    onChange={(e) =>
                      setTaskForm((current) => ({
                        ...current,
                        benchmarkMinutesPerCount:
                          benchmarkUnit === "HOUR"
                            ? Number(e.target.value) * 60
                            : Number(e.target.value),
                      }))
                    }
                  />
                  <div className="employee-tasks-view-toggle manager-unit-toggle">
                    <button className={benchmarkUnit === "HOUR" ? "is-active" : ""} onClick={() => setBenchmarkUnit("HOUR")} type="button">
                      Hour
                    </button>
                    <button className={benchmarkUnit === "MIN" ? "is-active" : ""} onClick={() => setBenchmarkUnit("MIN")} type="button">
                      Min
                    </button>
                  </div>
                </div>
              </label>
            </>
          ) : null}
          <label className="field">
            <span className="manager-form-label">Due Date</span>
            <input
              className="input"
              type="date"
              value={taskForm.dueDateUtc.slice(0, 10)}
              onChange={(e) =>
                setTaskForm((current) => ({
                  ...current,
                  dueDateUtc: new Date(`${e.target.value}T00:00:00.000Z`).toISOString(),
                }))
              }
            />
          </label>
          <label className="field field--full">
            <span className="manager-form-label">
              {taskForm.assignmentType === "TEAM"
                ? "Assign Team"
                : taskForm.hasCountTracking
                  ? "Assign Employees"
                  : "Assign Employee"}
            </span>
            {taskForm.assignmentType === "TEAM" ? (
              <select
                className="input"
                value={taskForm.assignedTeamId}
                onChange={(e) =>
                  setTaskForm((current) => ({
                    ...current,
                    assignedTeamId: e.target.value,
                  }))
                }
              >
                <option value="">Select team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            ) : taskForm.hasCountTracking ? (
              <div className="manager-multiselect">
                <button
                  className="manager-multiselect__trigger"
                  onClick={() => setAssigneeDropdownOpen((current) => !current)}
                  type="button"
                >
                  <span>
                    {taskForm.assigneeIds.length > 0
                      ? activeEmployees
                          .filter((employee) => taskForm.assigneeIds.includes(employee.id))
                          .map((employee) => employee.fullName)
                          .join(", ")
                      : "Select employees"}
                  </span>
                  <span>{assigneeDropdownOpen ? "▴" : "▾"}</span>
                </button>
                {assigneeDropdownOpen ? (
                  <div className="manager-multiselect__menu">
                    {activeEmployees.map((employee) => (
                      <label key={employee.id} className="manager-checkbox-item">
                        <input
                          checked={taskForm.assigneeIds.includes(employee.id)}
                          onChange={(event) =>
                            setTaskForm((current) => ({
                              ...current,
                              assigneeIds: event.target.checked
                                ? [...current.assigneeIds, employee.id]
                                : current.assigneeIds.filter((assigneeId) => assigneeId !== employee.id),
                            }))
                          }
                          type="checkbox"
                        />
                        <span>{employee.fullName}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <select
                className="input"
                value={taskForm.assigneeId}
                onChange={(e) =>
                  setTaskForm((current) => ({
                    ...current,
                    assigneeId: e.target.value,
                  }))
                }
              >
                <option value="">Assign employee</option>
                {activeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName}
                  </option>
                ))}
              </select>
            )}
          </label>
          <div className="manager-form-actions manager-form-actions--full">
            <LoadingButton className="timesheet-primary-button" loading={submittingSection === "task"} type="submit">Create Task</LoadingButton>
          </div>
        </form>
      </Card>

      <section className="manager-dashboard-section">
        <div className="manager-dashboard-section__header">
          <h3>Tasks</h3>
        </div>
        <div className="manager-dashboard-table-card">
          <table className="manager-dashboard-table table--clickable">
            <thead>
              <tr>
                <th>Title</th>
                <th>Project</th>
                <th>Activity</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const assignees = knownEmployees.filter((employee) =>
                  (task.assigneeIds ?? [task.assigneeId]).includes(employee.id),
                );
                const taskTeams = teams.filter((team) => (task.assignedTeamIds ?? []).includes(team.id));
                const primaryAssignee = assignees[0];
                const startedAt = toLocalDateAndTimeParts(task.startedAtUtc, primaryAssignee?.timezone);
                const completedAt = toLocalDateAndTimeParts(task.completedAtUtc, primaryAssignee?.timezone);

                return (
                  <tr key={task.id} onClick={() => setDrawerTaskId(task.id)}>
                    <td className="manager-dashboard-table__strong">{task.title}</td>
                    <td>{projects.find((project) => project.id === task.projectId)?.name ?? task.projectId}</td>
                    <td>{activities.find((activity) => activity.id === task.activityId)?.name ?? task.activityId}</td>
                    <td>
                      {taskTeams.length > 0
                        ? `${taskTeams.map((team) => team.name).join(", ")} (${assignees.length} members)`
                        : assignees.map((employee) => employee.fullName).join(", ") || task.assigneeId}
                    </td>
                    <td>{taskStatusLabelMap[task.status]}</td>
                    <td>{toLocalDate(task.dueDateUtc, primaryAssignee?.timezone)}</td>
                    <td>
                      <div className="task-date-time-cell">
                        <span>{startedAt.date}</span>
                        <span>{startedAt.time}</span>
                      </div>
                    </td>
                    <td>
                      <div className="task-date-time-cell">
                        <span>{completedAt.date}</span>
                        <span>{completedAt.time}</span>
                      </div>
                    </td>
                    <td>{`${task.loggedMinutes}m / ${task.estimatedHours}h`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
