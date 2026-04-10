import { useEffect, useMemo, useState } from "react";

import {
  Activity,
  ApprovalStatus,
  ApprovalType,
  Project,
  Task,
  User,
  type ApprovalRequest,
} from "@/shared";
import { LoadingButton } from "@/components/loading-button";
import { api } from "@/lib/api";
import { showSuccessToast } from "@/lib/toast";
import { useDebounce } from "@/hooks/use-debounce";

const PAGE_SIZE = 8;

const approvalTypeLabelMap: Record<ApprovalType, string> = {
  [ApprovalType.DUE_DATE_CHANGE]: "Due Date",
  [ApprovalType.TASK_COMPLETION]: "Completion",
  [ApprovalType.MANUAL_LOG]: "Time Edit",
  [ApprovalType.TASK_UPDATE]: "Task Update",
};

const approvalStatusLabelMap: Record<ApprovalStatus, string> = {
  [ApprovalStatus.PENDING]: "Pending",
  [ApprovalStatus.APPROVED]: "Approved",
  [ApprovalStatus.REJECTED]: "Rejected",
};

const approvalStatusClassMap: Record<ApprovalStatus, string> = {
  [ApprovalStatus.PENDING]: "employee-task-pill employee-task-pill--pending",
  [ApprovalStatus.APPROVED]: "employee-task-pill employee-task-pill--completed",
  [ApprovalStatus.REJECTED]: "employee-task-pill employee-task-pill--rejected",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

export const ManagerApprovalsPage = () => {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rejectingApprovalId, setRejectingApprovalId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [loadingApprovalId, setLoadingApprovalId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchInput.trim(), 400);

  const load = async () => {
    const [approvalsData, tasksData, projectsData, activitiesData, employeesData] = await Promise.all([
      api<ApprovalRequest[]>("/approvals"),
      api<Task[]>("/tasks"),
      api<Project[]>("/projects"),
      api<Activity[]>("/activities"),
      api<User[]>("/users?scope=team&role=EMPLOYEE"),
    ]);

    setApprovals(approvalsData);
    setTasks(tasksData);
    setProjects(projectsData);
    setActivities(activitiesData);
    setEmployees(employeesData);
  };

  useEffect(() => {
    void load();
  }, []);

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );
  const activityMap = useMemo(
    () => new Map(activities.map((activity) => [activity.id, activity.name])),
    [activities],
  );
  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee.fullName])),
    [employees],
  );

  const approvalRows = useMemo(() => {
    return approvals.map((approval) => {
      const task = taskMap.get(approval.taskId);
      const projectName = task ? projectMap.get(task.projectId) ?? "Project" : "Project";
      const activityName = task ? activityMap.get(task.activityId) ?? "Activity" : "Activity";
      const memberName = employeeMap.get(approval.requestedBy) ?? "Team member";

      let details = `${projectName} / ${activityName}`;

      if (task) {
        details = `${projectName} / ${activityName} / ${task.title}`;
      }

      if (approval.type === ApprovalType.DUE_DATE_CHANGE) {
        const requestedDueDate =
          typeof approval.payload?.requestedDueDateUtc === "string"
            ? formatDate(approval.payload.requestedDueDateUtc)
            : "Requested date";
        details = `${details} -> ${requestedDueDate}`;
      }

      return {
        ...approval,
        memberName,
        details,
      };
    });
  }, [activityMap, approvals, employeeMap, projectMap, taskMap]);

  const filteredApprovals = useMemo(() => {
    return approvalRows.filter((approval) => {
      const matchesSearch =
        debouncedSearch.length === 0 ||
        approval.memberName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        approval.reason.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        approval.details.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesType = selectedType.length === 0 || approval.type === selectedType;
      const matchesStatus = selectedStatus.length === 0 || approval.status === selectedStatus;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [approvalRows, debouncedSearch, selectedStatus, selectedType]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedStatus, selectedType]);

  const totalPages = Math.max(1, Math.ceil(filteredApprovals.length / PAGE_SIZE));
  const pagedApprovals = filteredApprovals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const review = async (approvalId: string, status: ApprovalStatus) => {
    setLoadingApprovalId(approvalId);
    try {
      await api(`/approvals/${approvalId}/review`, {
        method: "POST",
        body: JSON.stringify({
          status,
          managerComment: status === ApprovalStatus.APPROVED ? "Approved" : rejectComment.trim(),
        }),
        suppressGlobalLoader: true,
      });
      showSuccessToast(`Approval ${status.toLowerCase()}`);
      setRejectingApprovalId(null);
      setRejectComment("");
      await load();
    } finally {
      setLoadingApprovalId(null);
    }
  };

  const summaryCards = useMemo(
    () => [
      { label: "Total Requests", value: approvals.length },
      {
        label: "Pending",
        value: approvals.filter((approval) => approval.status === ApprovalStatus.PENDING).length,
      },
      {
        label: "Approved",
        value: approvals.filter((approval) => approval.status === ApprovalStatus.APPROVED).length,
      },
      {
        label: "Rejected",
        value: approvals.filter((approval) => approval.status === ApprovalStatus.REJECTED).length,
      },
    ],
    [approvals],
  );

  return (
    <div className="manager-dashboard-page">
      <div className="employee-tasks-toolbar">
        <div className="employee-tasks-count">{approvals.length} approval requests</div>
        <div className="employee-tasks-controls">
          <label className="employee-tasks-search">
            <span className="employee-tasks-search__icon">⌕</span>
            <input
              type="search"
              placeholder="Search Approvals"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>
          <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
            <option value="">All Type</option>
            {Object.values(ApprovalType).map((type) => (
              <option key={type} value={type}>
                {approvalTypeLabelMap[type]}
              </option>
            ))}
          </select>
          <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
            <option value="">All Status</option>
            {Object.values(ApprovalStatus).map((status) => (
              <option key={status} value={status}>
                {approvalStatusLabelMap[status]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="employee-tasks-summary employee-tasks-summary--four">
        {summaryCards.map((card) => (
          <article key={card.label} className="employee-tasks-summary__card">
            <span>{card.label}</span>
            <strong>{String(card.value).padStart(2, "0")}</strong>
          </article>
        ))}
      </section>

      <section className="manager-dashboard-section">
        <div className="manager-dashboard-section__header">
          <h3>Pending Approvals</h3>
        </div>
        <div className="manager-dashboard-table-card">
          <table className="manager-dashboard-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Type</th>
                <th>Details</th>
                <th>Reason</th>
                <th>Date</th>
                <th>Status</th>
                <th>Manager Comment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedApprovals.map((approval) => (
                <tr key={approval.id}>
                  <td className="manager-dashboard-table__strong">{approval.memberName}</td>
                  <td>
                    <span className="manager-approval-type-pill">{approvalTypeLabelMap[approval.type]}</span>
                  </td>
                  <td>{approval.details}</td>
                  <td>{approval.reason}</td>
                  <td>{formatDate(approval.requestedAtUtc)}</td>
                  <td>
                    <span className={approvalStatusClassMap[approval.status]}>
                      {approvalStatusLabelMap[approval.status]}
                    </span>
                  </td>
                  <td>{approval.managerComment?.trim() || "-"}</td>
                  <td>
                    {approval.status === ApprovalStatus.PENDING ? (
                      <div className="manager-approval-actions">
                        <LoadingButton
                          className="timesheet-primary-button"
                          loading={loadingApprovalId === approval.id}
                          onClick={() => void review(approval.id, ApprovalStatus.APPROVED)}
                          type="button"
                        >
                          Approve
                        </LoadingButton>
                        <button
                          className="timesheet-secondary-button"
                          onClick={() => {
                            setRejectingApprovalId(approval.id);
                            setRejectComment("");
                          }}
                          type="button"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="manager-dashboard-inactive">Reviewed</span>
                    )}
                  </td>
                </tr>
              ))}
              {pagedApprovals.length === 0 ? (
                <tr>
                  <td className="employee-task-table__empty" colSpan={8}>
                    No approvals matched the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="employee-tasks-footer">
        <span>
          Showing {pagedApprovals.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-
          {(page - 1) * PAGE_SIZE + pagedApprovals.length} of {filteredApprovals.length} requests
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
      {rejectingApprovalId ? (
        <div className="task-modal-overlay" onClick={() => setRejectingApprovalId(null)} role="presentation">
          <div className="task-modal" onClick={(event) => event.stopPropagation()}>
            <div className="task-modal__header">
              <div>
                <h3>Reject Approval</h3>
                <p>This comment will be visible to the employee.</p>
              </div>
              <button className="task-modal__close" onClick={() => setRejectingApprovalId(null)} type="button">
                ×
              </button>
            </div>
            <div className="task-modal__content">
              <div className="task-modal__field">
                <span>Manager Comment</span>
                <textarea
                  className="task-modal__textarea"
                  placeholder="Explain why this request is being rejected"
                  rows={4}
                  value={rejectComment}
                  onChange={(event) => setRejectComment(event.target.value)}
                />
              </div>
            </div>
            <div className="task-modal__actions">
              <button className="timesheet-secondary-button" onClick={() => setRejectingApprovalId(null)} type="button">
                Cancel
              </button>
              <LoadingButton
                className="timesheet-primary-button"
                loading={loadingApprovalId === rejectingApprovalId}
                disabled={rejectComment.trim().length === 0}
                onClick={() => void review(rejectingApprovalId, ApprovalStatus.REJECTED)}
                type="button"
              >
                Reject Request
              </LoadingButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
