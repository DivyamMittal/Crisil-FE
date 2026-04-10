import { useEffect, useMemo, useState } from "react";

import { CompanyRole, UserRole, type User } from "@/shared";
import { LoadingButton } from "@/components/loading-button";
import { api } from "@/lib/api";
import { showSuccessToast } from "@/lib/toast";
import { supportedTimezones } from "@/shared/timezones";

const userRoleLabelMap: Record<UserRole, string> = {
  [UserRole.ADMIN]: "Admin",
  [UserRole.MANAGER]: "Manager",
  [UserRole.EMPLOYEE]: "Employee",
};

const companyRoleLabelMap: Record<CompanyRole, string> = {
  [CompanyRole.DEVELOPER]: "Developer",
  [CompanyRole.ANALYST]: "Analyst",
  [CompanyRole.EDITOR]: "Editor",
  [CompanyRole.QA]: "QA",
  [CompanyRole.MANAGER]: "Manager",
  [CompanyRole.OTHER]: "Other",
};

const userStatusLabel = (isActive: boolean) => (isActive ? "Active" : "Inactive");
const userStatusClassName = (isActive: boolean) =>
  isActive ? "employee-task-pill employee-task-pill--completed" : "employee-task-pill employee-task-pill--rejected";

export const AdminPage = ({ title }: { title: string }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    userRole: UserRole.MANAGER,
    companyRole: CompanyRole.MANAGER,
    timezone: "Asia/Kolkata",
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [statusLoadingUserId, setStatusLoadingUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    setUsers(await api<User[]>("/users"));
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const summaryCards = useMemo(
    () => [
      { label: "Total Users", value: users.length, helper: "All platform accounts" },
      {
        label: "Managers",
        value: users.filter((user) => user.userRole === UserRole.MANAGER).length,
        helper: "Active team leads",
      },
      {
        label: "Employees",
        value: users.filter((user) => user.userRole === UserRole.EMPLOYEE).length,
        helper: "Assigned contributors",
      },
      {
        label: "Blocked Users",
        value: users.filter((user) => !user.isActive).length,
        helper: "Login disabled accounts",
      },
    ],
    [users],
  );

  const toggleStatus = async (userId: string, isActive: boolean) => {
    setStatusLoadingUserId(userId);
    try {
      await api(`/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
        suppressGlobalLoader: true,
      });
      showSuccessToast(isActive ? "User unblocked" : "User blocked");
      await loadUsers();
    } finally {
      setStatusLoadingUserId(null);
    }
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setCreatingUser(true);
    try {
      await api("/users", {
        method: "POST",
        body: JSON.stringify(form),
        suppressGlobalLoader: true,
      });
      showSuccessToast("User created successfully");

      setForm({
        email: "",
        password: "",
        fullName: "",
        userRole: UserRole.MANAGER,
        companyRole: CompanyRole.MANAGER,
        timezone: "Asia/Kolkata",
      });
      await loadUsers();
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div className="manager-dashboard-page">
      <div className="employee-tasks-toolbar">
        <div className="employee-tasks-count">{title}</div>
      </div>

      <section className="manager-dashboard-stats">
        {summaryCards.map((card) => (
          <article key={card.label} className="manager-dashboard-stat">
            <span>{card.label}</span>
            <strong>{String(card.value).padStart(2, "0")}</strong>
            <p>{card.helper}</p>
          </article>
        ))}
      </section>

      <section className="manager-dashboard-section">
        <div className="manager-dashboard-section__header">
          <h3>Create User</h3>
        </div>
        <div className="manager-dashboard-table-card manager-form-card">
          <form className="form-grid form-grid--two" onSubmit={handleCreate}>
            <label className="field">
              <span className="manager-form-label">Full Name</span>
              <input
                className="input"
                placeholder="Rohan Mehta"
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
              />
            </label>
            <label className="field">
              <span className="manager-form-label">Email</span>
              <input
                className="input"
                placeholder="rohan@yopmail.com"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label className="field">
              <span className="manager-form-label">Password</span>
              <input
                className="input"
                placeholder="Enter password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              />
            </label>
            <label className="field">
              <span className="manager-form-label">User Role</span>
              <select
                className="input"
                value={form.userRole}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    userRole: event.target.value as UserRole,
                    companyRole:
                      event.target.value === UserRole.MANAGER ? CompanyRole.MANAGER : current.companyRole,
                  }))
                }
              >
                <option value={UserRole.MANAGER}>Manager</option>
                <option value={UserRole.EMPLOYEE}>Employee</option>
              </select>
            </label>
            <label className="field">
              <span className="manager-form-label">Company Role</span>
              <select
                className="input"
                value={form.companyRole}
                onChange={(event) =>
                  setForm((current) => ({ ...current, companyRole: event.target.value as CompanyRole }))
                }
              >
                {Object.values(CompanyRole).map((role) => (
                  <option key={role} value={role}>
                    {companyRoleLabelMap[role]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="manager-form-label">Timezone</span>
              <select
                className="input"
                value={form.timezone}
                onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
              >
                {supportedTimezones.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </select>
            </label>
            <div className="manager-form-actions manager-form-actions--full">
              <LoadingButton className="timesheet-primary-button" loading={creatingUser} type="submit">
                Create User
              </LoadingButton>
            </div>
          </form>
        </div>
      </section>

      <section className="manager-dashboard-section">
        <div className="manager-dashboard-section__header">
          <h3>User Directory</h3>
        </div>
        <div className="manager-dashboard-table-card">
          <table className="manager-dashboard-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>User Role</th>
                <th>Company Role</th>
                <th>Timezone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="manager-dashboard-table__strong">{user.fullName}</td>
                  <td>{user.email}</td>
                  <td>{userRoleLabelMap[user.userRole]}</td>
                  <td>{companyRoleLabelMap[user.companyRole]}</td>
                  <td>{user.timezone}</td>
                  <td>
                    <span className={userStatusClassName(user.isActive)}>{userStatusLabel(user.isActive)}</span>
                  </td>
                  <td>
                    {user.userRole !== UserRole.ADMIN ? (
                      <div className="manager-approval-actions">
                        <LoadingButton
                          className={user.isActive ? "timesheet-secondary-button" : "timesheet-primary-button"}
                          loading={statusLoadingUserId === user.id}
                          onClick={() => void toggleStatus(user.id, !user.isActive)}
                          type="button"
                        >
                          {user.isActive ? "Block" : "Unblock"}
                        </LoadingButton>
                      </div>
                    ) : (
                      <span className="manager-dashboard-inactive">Protected</span>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td className="employee-task-table__empty" colSpan={7}>
                    No users found.
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
