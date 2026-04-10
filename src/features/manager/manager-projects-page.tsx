import { useEffect, useState } from "react";

import { Priority, ProjectStatus, TaskStatus, type Task, type User } from "@/shared";
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
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
    assigneeId: "",
    priority: Priority.MEDIUM,
    estimatedHours: 8,
    dueDateUtc: new Date(Date.now() + 2 * 86400000).toISOString(),
  });
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const [submittingSection, setSubmittingSection] = useState<"project" | "activity" | "task" | null>(null);
  const activeEmployees = employees.filter((employee) => employee.isActive);

  const load = async () => {
    const [projectsData, activitiesData, tasksData, employeesData] = await Promise.all([
      api<Project[]>("/projects"),
      api<Activity[]>("/activities"),
      api<Task[]>("/tasks"),
      api<User[]>("/users?scope=team&role=EMPLOYEE"),
    ]);

    setProjects(projectsData);
    setActivities(activitiesData);
    setTasks(tasksData);
    setEmployees(employeesData);
  };

  useEffect(() => {
    void load();
  }, []);

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
              await api("/tasks", { method: "POST", body: JSON.stringify(taskForm), suppressGlobalLoader: true });
              showSuccessToast("Task created successfully");
              setTaskForm((current) => ({ ...current, title: "", description: "" }));
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
          <label className="field">
            <span className="manager-form-label">Assign Employee</span>
            <select className="input" value={taskForm.assigneeId} onChange={(e) => setTaskForm((current) => ({ ...current, assigneeId: e.target.value }))}>
              <option value="">Assign employee</option>
              {activeEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.fullName}</option>
              ))}
            </select>
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
            <input className="input" type="number" min="1" value={taskForm.estimatedHours} onChange={(e) => setTaskForm((current) => ({ ...current, estimatedHours: Number(e.target.value) }))} />
          </label>
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
          <div className="manager-form-actions">
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
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} onClick={() => setDrawerTaskId(task.id)}>
                  <td className="manager-dashboard-table__strong">{task.title}</td>
                  <td>{projects.find((project) => project.id === task.projectId)?.name ?? task.projectId}</td>
                  <td>{activities.find((activity) => activity.id === task.activityId)?.name ?? task.activityId}</td>
                  <td>{employees.find((employee) => employee.id === task.assigneeId)?.fullName ?? task.assigneeId}</td>
                  <td>{taskStatusLabelMap[task.status]}</td>
                  <td>{new Date(task.dueDateUtc).toLocaleDateString("en-GB")}</td>
                  <td>{`${task.loggedMinutes}m / ${task.estimatedHours}h`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
