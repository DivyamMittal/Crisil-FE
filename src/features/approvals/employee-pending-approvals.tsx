import { useEffect, useMemo, useState } from "react";

import { ApprovalStatus, ApprovalType, type ApprovalRequest } from "@/shared";
import { api } from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";

const PAGE_SIZE = 8;

const approvalTypeLabelMap: Record<ApprovalType, string> = {
  [ApprovalType.DUE_DATE_CHANGE]: "Due Date Change",
  [ApprovalType.TASK_COMPLETION]: "Task Completion",
  [ApprovalType.MANUAL_LOG]: "Manual Log",
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

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

export const EmployeePendingApprovalsPage = () => {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(searchInput.trim(), 400);

  useEffect(() => {
    void api<ApprovalRequest[]>("/approvals").then(setApprovals);
  }, []);

  const filteredApprovals = useMemo(() => {
    return approvals.filter((approval) => {
      const matchesSearch =
        debouncedSearch.length === 0 ||
        approvalTypeLabelMap[approval.type].toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        approval.reason.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesType = selectedType.length === 0 || approval.type === selectedType;
      const matchesStatus = selectedStatus.length === 0 || approval.status === selectedStatus;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [approvals, debouncedSearch, selectedStatus, selectedType]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedStatus, selectedType]);

  const totalPages = Math.max(1, Math.ceil(filteredApprovals.length / PAGE_SIZE));
  const pagedApprovals = filteredApprovals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
    <div className="employee-tasks-page">
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

      <section className="employee-task-table-card">
        <table className="employee-task-table">
          <thead>
            <tr>
              <th>S. N</th>
              <th>Request Type</th>
              <th>Reason</th>
              <th>Requested On</th>
              <th>Status</th>
              <th>Manager Comment</th>
            </tr>
          </thead>
          <tbody>
            {pagedApprovals.map((approval, index) => (
              <tr key={approval.id}>
                <td>{String((page - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}</td>
                <td className="employee-task-table__strong">{approvalTypeLabelMap[approval.type]}</td>
                <td>{approval.reason}</td>
                <td>{formatDateTime(approval.requestedAtUtc)}</td>
                <td>
                  <span className={approvalStatusClassMap[approval.status]}>
                    {approvalStatusLabelMap[approval.status]}
                  </span>
                </td>
                <td>{approval.managerComment?.trim() || "-"}</td>
              </tr>
            ))}
            {pagedApprovals.length === 0 ? (
              <tr>
                <td className="employee-task-table__empty" colSpan={6}>
                  No approval requests matched the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
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
    </div>
  );
};
