import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApprovalStatus, ApprovalType, TaskStatus } from "@/shared";
import { LoadingButton } from "@/components/loading-button";
import { api } from "@/lib/api";
import { showSuccessToast } from "@/lib/toast";

type ManagerDashboardResponse = {
  period: {
    type: "today" | "week" | "month";
    label: string;
    offset: number;
    start: string;
    end: string;
  };
  headlineStats: Array<{ label: string; value: string; helper: string }>;
  liveActivity: Array<{
    memberId: string;
    memberName: string;
    project: string;
    activity: string;
    task: string;
    status: TaskStatus | null;
    timeLogged: string;
  }>;
  pendingApprovals: Array<{
    id: string;
    memberName: string;
    type: ApprovalType;
    details: string;
    reason: string;
    requestedAtUtc: string;
    status: ApprovalStatus;
  }>;
};

const statusLabelMap: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: "Pending",
  [TaskStatus.WIP]: "WIP",
  [TaskStatus.ON_HOLD]: "On Hold",
  [TaskStatus.APPROVAL_PENDING]: "Approval Pending",
  [TaskStatus.REJECTED]: "Rejected",
  [TaskStatus.COMPLETED]: "Completed",
};

const statusClassMap: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: "employee-task-pill employee-task-pill--neutral",
  [TaskStatus.WIP]: "employee-task-pill employee-task-pill--wip",
  [TaskStatus.ON_HOLD]: "employee-task-pill employee-task-pill--hold",
  [TaskStatus.APPROVAL_PENDING]: "employee-task-pill employee-task-pill--pending",
  [TaskStatus.REJECTED]: "employee-task-pill employee-task-pill--rejected",
  [TaskStatus.COMPLETED]: "employee-task-pill employee-task-pill--completed",
};

const approvalTypeLabelMap: Record<ApprovalType, string> = {
  [ApprovalType.DUE_DATE_CHANGE]: "Due Date",
  [ApprovalType.TASK_COMPLETION]: "Completion",
  [ApprovalType.MANUAL_LOG]: "Time Edit",
  [ApprovalType.TASK_UPDATE]: "Task Update",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

const getInitials = (fullName: string) =>
  fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export const ManagerDashboardPage = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<"today" | "week" | "month">("week");
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [data, setData] = useState<ManagerDashboardResponse | null>(null);
  const [loadingApprovalId, setLoadingApprovalId] = useState<string | null>(null);

  const load = async (nextPeriod: "today" | "week" | "month", nextOffset: number) => {
    setData(await api<ManagerDashboardResponse>(`/analytics/dashboard?period=${nextPeriod}&offset=${nextOffset}`));
  };

  useEffect(() => {
    void load(period, offset);
  }, [period, offset]);

  const reviewApproval = async (approvalId: string, status: ApprovalStatus) => {
    setLoadingApprovalId(approvalId);
    try {
      await api(`/approvals/${approvalId}/review`, {
        method: "POST",
        body: JSON.stringify({
          status,
          managerComment: status === ApprovalStatus.APPROVED ? "Approved" : "Rejected",
        }),
        suppressGlobalLoader: true,
      });

      showSuccessToast(`Approval ${status.toLowerCase()}`);
      await load(period, offset);
    } finally {
      setLoadingApprovalId(null);
    }
  };

  const filteredActivity = useMemo(() => {
    if (!data) {
      return [];
    }

    if (!statusFilter) {
      return data.liveActivity;
    }

    return data.liveActivity.filter((item) => item.status === statusFilter);
  }, [data, statusFilter]);

  return (
    <div className="manager-dashboard-page">
      <div className="manager-dashboard-topbar">
        <div className="manager-week-switcher">
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
          <button onClick={() => setOffset((current) => current - 1)} type="button">
            ‹ Prev
          </button>
          <strong>{data?.period.label ?? "Loading range..."}</strong>
          <button disabled={offset === 0} onClick={() => setOffset((current) => Math.min(0, current + 1))} type="button">
            Next ›
          </button>
        </div>
        <div className="manager-dashboard-quick-actions">
          <button className="timesheet-secondary-button" onClick={() => navigate("/manager/calendar")} type="button">
            Mark Holiday
          </button>
          <button className="timesheet-primary-button" onClick={() => navigate("/manager/projects")} type="button">
            + Assign Task
          </button>
        </div>
      </div>

      <section className="manager-dashboard-actions">
        <h2>Team KPIs</h2>
        <div className="manager-dashboard-stats">
          {(data?.headlineStats ?? []).map((stat) => (
            <article key={stat.label} className="manager-dashboard-stat">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <p>{stat.helper}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="manager-dashboard-section">
        <div className="manager-dashboard-section__header">
          <h3>Live Team Activity</h3>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All Status</option>
            {Object.values(TaskStatus).map((status) => (
              <option key={status} value={status}>
                {statusLabelMap[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="manager-dashboard-table-card">
          <table className="manager-dashboard-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Project</th>
                <th>Activity</th>
                <th>Task</th>
                <th>Status</th>
                <th>Time Logged</th>
              </tr>
            </thead>
            <tbody>
              {filteredActivity.map((item) => (
                <tr key={item.memberId}>
                  <td>
                    <div className="manager-member-cell">
                      <span className="manager-member-badge">{getInitials(item.memberName)}</span>
                      <strong>{item.memberName}</strong>
                    </div>
                  </td>
                  <td>{item.project}</td>
                  <td>{item.activity}</td>
                  <td>{item.task}</td>
                  <td>
                    {item.status ? (
                      <span className={statusClassMap[item.status]}>{statusLabelMap[item.status]}</span>
                    ) : (
                      <span className="manager-dashboard-inactive">Inactive</span>
                    )}
                  </td>
                  <td>{item.timeLogged}</td>
                </tr>
              ))}
              {filteredActivity.length === 0 ? (
                <tr>
                  <td className="employee-task-table__empty" colSpan={6}>
                    No team activity found for the selected period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="manager-dashboard-section">
        <div className="manager-dashboard-section__header">
          <h3>Pending Approvals</h3>
          <button className="manager-dashboard-link" onClick={() => navigate("/manager/approvals")} type="button">
            View All
          </button>
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.pendingApprovals ?? []).map((approval) => (
                <tr key={approval.id}>
                  <td className="manager-dashboard-table__strong">{approval.memberName}</td>
                  <td>
                    <span className="manager-approval-type-pill">{approvalTypeLabelMap[approval.type]}</span>
                  </td>
                  <td>{approval.details}</td>
                  <td>{approval.reason}</td>
                  <td>{formatDate(approval.requestedAtUtc)}</td>
                  <td>
                    <div className="manager-approval-actions">
                      <LoadingButton
                        className="timesheet-primary-button"
                        loading={loadingApprovalId === approval.id}
                        onClick={() => void reviewApproval(approval.id, ApprovalStatus.APPROVED)}
                        type="button"
                      >
                        Approve
                      </LoadingButton>
                      <LoadingButton
                        className="timesheet-secondary-button"
                        loading={loadingApprovalId === approval.id}
                        onClick={() => void reviewApproval(approval.id, ApprovalStatus.REJECTED)}
                        type="button"
                      >
                        Reject
                      </LoadingButton>
                    </div>
                  </td>
                </tr>
              ))}
              {(data?.pendingApprovals.length ?? 0) === 0 ? (
                <tr>
                  <td className="employee-task-table__empty" colSpan={6}>
                    No pending approvals for the selected period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
