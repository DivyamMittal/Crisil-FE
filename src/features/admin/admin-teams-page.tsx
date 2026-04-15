import { useEffect, useMemo, useState } from "react";

import { LoadingButton } from "@/components/loading-button";
import { api } from "@/lib/api";
import { showSuccessToast } from "@/lib/toast";
import { UserRole, type Team, type User } from "@/shared";

const createEmptyForm = () => ({
  id: null as string | null,
  name: "",
  managerIds: [] as string[],
  memberIds: [] as string[],
});

export const AdminTeamsPage = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [form, setForm] = useState(createEmptyForm);
  const [managerDropdownOpen, setManagerDropdownOpen] = useState(false);
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);

  const load = async () => {
    const [teamsData, managerData, employeeData] = await Promise.all([
      api<Team[]>("/teams"),
      api<User[]>(`/users?role=${UserRole.MANAGER}`),
      api<User[]>(`/users?role=${UserRole.EMPLOYEE}`),
    ]);

    setTeams(teamsData);
    setManagers(managerData.filter((user) => user.isActive));
    setEmployees(employeeData.filter((user) => user.isActive));
  };

  useEffect(() => {
    void load();
  }, []);

  const summaryCards = useMemo(
    () => [
      { label: "Teams", value: teams.length, helper: "Configured team groups" },
      {
        label: "Managers",
        value: new Set(teams.flatMap((team) => team.managerIds)).size,
        helper: "Managers assigned to teams",
      },
      {
        label: "Members",
        value: new Set(teams.flatMap((team) => team.memberIds)).size,
        helper: "Employees mapped to teams",
      },
      {
        label: "Avg Team Size",
        value: teams.length ? Math.round(teams.reduce((sum, team) => sum + team.memberIds.length, 0) / teams.length) : 0,
        helper: "Average employee count per team",
      },
    ],
    [teams],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api(form.id ? `/teams/${form.id}` : "/teams", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify({
          name: form.name,
          managerIds: form.managerIds,
          memberIds: form.memberIds,
        }),
        suppressGlobalLoader: true,
      });
      showSuccessToast(form.id ? "Team updated successfully" : "Team created successfully");
      setForm(createEmptyForm());
      setManagerDropdownOpen(false);
      setMemberDropdownOpen(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (teamId: string) => {
    setDeletingTeamId(teamId);
    try {
      await api(`/teams/${teamId}`, {
        method: "DELETE",
        suppressGlobalLoader: true,
      });
      showSuccessToast("Team deleted successfully");
      if (form.id === teamId) {
        setForm(createEmptyForm());
      }
      await load();
    } finally {
      setDeletingTeamId(null);
    }
  };

  const selectedManagerNames = managers
    .filter((manager) => form.managerIds.includes(manager.id))
    .map((manager) => manager.fullName)
    .join(", ");
  const selectedMemberNames = employees
    .filter((employee) => form.memberIds.includes(employee.id))
    .map((employee) => employee.fullName)
    .join(", ");

  return (
    <div className="manager-dashboard-page">
      <div className="employee-tasks-toolbar">
        <div className="employee-tasks-count">Manage teams, team managers, and team members</div>
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
          <h3>{form.id ? "Edit Team" : "Create Team"}</h3>
        </div>
        <div className="manager-dashboard-table-card manager-form-card">
          <form className="form-grid form-grid--two" onSubmit={handleSubmit}>
            <label className="field field--full">
              <span className="manager-form-label">Team Name</span>
              <input
                className="input"
                placeholder="Financial Research Team"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="field">
              <span className="manager-form-label">Managers</span>
              <div className="manager-multiselect">
                <button
                  className="manager-multiselect__trigger"
                  onClick={() => setManagerDropdownOpen((current) => !current)}
                  type="button"
                >
                  <span>{selectedManagerNames || "Select managers"}</span>
                  <span>{managerDropdownOpen ? "▴" : "▾"}</span>
                </button>
                {managerDropdownOpen ? (
                  <div className="manager-multiselect__menu">
                    {managers.map((manager) => (
                      <label key={manager.id} className="manager-checkbox-item">
                        <input
                          checked={form.managerIds.includes(manager.id)}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              managerIds: event.target.checked
                                ? [...current.managerIds, manager.id]
                                : current.managerIds.filter((managerId) => managerId !== manager.id),
                            }))
                          }
                          type="checkbox"
                        />
                        <span>{manager.fullName}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            </label>
            <label className="field">
              <span className="manager-form-label">Members</span>
              <div className="manager-multiselect">
                <button
                  className="manager-multiselect__trigger"
                  onClick={() => setMemberDropdownOpen((current) => !current)}
                  type="button"
                >
                  <span>{selectedMemberNames || "Select employees"}</span>
                  <span>{memberDropdownOpen ? "▴" : "▾"}</span>
                </button>
                {memberDropdownOpen ? (
                  <div className="manager-multiselect__menu">
                    {employees.map((employee) => (
                      <label key={employee.id} className="manager-checkbox-item">
                        <input
                          checked={form.memberIds.includes(employee.id)}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              memberIds: event.target.checked
                                ? [...current.memberIds, employee.id]
                                : current.memberIds.filter((memberId) => memberId !== employee.id),
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
            </label>
            <div className="manager-form-actions manager-form-actions--full manager-form-actions--between">
              <button
                className="timesheet-secondary-button"
                onClick={() => {
                  setForm(createEmptyForm());
                  setManagerDropdownOpen(false);
                  setMemberDropdownOpen(false);
                }}
                type="button"
              >
                Clear
              </button>
              <LoadingButton className="timesheet-primary-button" loading={submitting} type="submit">
                {form.id ? "Update Team" : "Create Team"}
              </LoadingButton>
            </div>
          </form>
        </div>
      </section>

      <section className="manager-dashboard-section">
        <div className="manager-dashboard-section__header">
          <h3>Teams</h3>
        </div>
        <div className="manager-dashboard-table-card">
          <table className="manager-dashboard-table">
            <thead>
              <tr>
                <th>Team Name</th>
                <th>Managers</th>
                <th>Members</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <td className="manager-dashboard-table__strong">{team.name}</td>
                  <td>{(team.managers ?? []).map((manager) => manager.fullName).join(", ") || "Unassigned"}</td>
                  <td>{(team.members ?? []).map((member) => member.fullName).join(", ") || "No members"}</td>
                  <td>
                    <div className="manager-approval-actions">
                      <button
                        className="timesheet-secondary-button"
                        onClick={() =>
                          setForm({
                            id: team.id,
                            name: team.name,
                            managerIds: team.managerIds,
                            memberIds: team.memberIds,
                          })
                        }
                        type="button"
                      >
                        Edit
                      </button>
                      <LoadingButton
                        className="timesheet-primary-button timesheet-primary-button--danger"
                        loading={deletingTeamId === team.id}
                        onClick={() => void handleDelete(team.id)}
                        type="button"
                      >
                        Delete
                      </LoadingButton>
                    </div>
                  </td>
                </tr>
              ))}
              {teams.length === 0 ? (
                <tr>
                  <td className="employee-task-table__empty" colSpan={4}>
                    No teams configured yet.
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
