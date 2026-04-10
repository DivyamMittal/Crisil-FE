import { useEffect, useMemo, useState } from "react";

import { type User } from "@/shared";
import { LoadingButton } from "@/components/loading-button";
import { api } from "@/lib/api";
import { showSuccessToast } from "@/lib/toast";

const statusLabel = (isActive: boolean) => (isActive ? "Active" : "Inactive");
const statusClassName = (isActive: boolean) =>
  isActive ? "employee-task-pill employee-task-pill--completed" : "employee-task-pill employee-task-pill--rejected";

export const ManagerTeamPage = () => {
  const [team, setTeam] = useState<User[]>([]);
  const [availableEmployees, setAvailableEmployees] = useState<User[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [assigning, setAssigning] = useState(false);

  const load = async () => {
    const [teamData, availableData] = await Promise.all([
      api<User[]>("/users?scope=team&role=EMPLOYEE"),
      api<User[]>("/users?scope=available&role=EMPLOYEE"),
    ]);
    setTeam(teamData);
    setAvailableEmployees(availableData);
  };

  useEffect(() => {
    void load();
  }, []);

  const summaryCards = useMemo(
    () => [
      { label: "Team Members", value: team.length },
      { label: "Active", value: team.filter((member) => member.isActive).length },
      { label: "Inactive", value: team.filter((member) => !member.isActive).length },
      { label: "Available Pool", value: availableEmployees.length },
    ],
    [availableEmployees.length, team],
  );

  return (
    <div className="manager-dashboard-page">
      <div className="employee-tasks-toolbar">
        <div className="employee-tasks-count">Manage your team members and allocation pool</div>
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
          <h3>Add Team Member</h3>
        </div>
        <div className="manager-dashboard-table-card manager-form-card">
          <form
            className="form-grid form-grid--two"
            onSubmit={async (event) => {
              event.preventDefault();

              if (!selectedEmployeeId) {
                return;
              }

              setAssigning(true);
              try {
                await api(`/users/${selectedEmployeeId}/assign-manager`, {
                  method: "POST",
                  body: JSON.stringify({}),
                  suppressGlobalLoader: true,
                });
                showSuccessToast("Employee assigned to your team");
                setSelectedEmployeeId("");
                await load();
              } finally {
                setAssigning(false);
              }
            }}
          >
            <label className="field field--full">
              <span className="manager-form-label">Existing Employee</span>
              <select
                className="input"
                value={selectedEmployeeId}
                onChange={(event) => setSelectedEmployeeId(event.target.value)}
              >
                <option value="">Select existing employee</option>
                {availableEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName} ({employee.email})
                  </option>
                ))}
              </select>
            </label>
            <div className="manager-form-actions manager-form-actions--full">
              <LoadingButton className="timesheet-primary-button" loading={assigning} type="submit">
                Add Existing Employee
              </LoadingButton>
            </div>
          </form>
        </div>
      </section>

      <section className="manager-dashboard-section">
        <div className="manager-dashboard-section__header">
          <h3>Team Members</h3>
        </div>
        <div className="manager-dashboard-table-card">
          <table className="manager-dashboard-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Timezone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {team.map((member) => (
                <tr key={member.id}>
                  <td className="manager-dashboard-table__strong">{member.fullName}</td>
                  <td>{member.email}</td>
                  <td>{member.companyRole}</td>
                  <td>{member.timezone}</td>
                  <td>
                    <span className={statusClassName(member.isActive)}>{statusLabel(member.isActive)}</span>
                  </td>
                </tr>
              ))}
              {team.length === 0 ? (
                <tr>
                  <td className="employee-task-table__empty" colSpan={5}>
                    No team members added yet.
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
