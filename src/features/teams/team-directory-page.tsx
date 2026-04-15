import { useEffect, useMemo, useState } from "react";

import { type Team } from "@/shared";
import { api } from "@/lib/api";

type TeamDirectoryPageProps = {
  title: string;
  subtitle: string;
};

export const TeamDirectoryPage = ({ title, subtitle }: TeamDirectoryPageProps) => {
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    void (async () => {
      setTeams(await api<Team[]>("/teams"));
    })();
  }, []);

  const uniqueMemberCount = useMemo(
    () => new Set(teams.flatMap((team) => (team.members ?? []).map((member) => member.id))).size,
    [teams],
  );
  const uniqueManagerCount = useMemo(
    () => new Set(teams.flatMap((team) => (team.managers ?? []).map((manager) => manager.id))).size,
    [teams],
  );
  const activeMemberCount = useMemo(
    () => teams.flatMap((team) => team.members ?? []).filter((member) => member.isActive).length,
    [teams],
  );

  return (
    <div className="manager-dashboard-page">
      <div className="employee-tasks-toolbar">
        <div className="employee-tasks-count">{subtitle}</div>
      </div>

      <section className="employee-tasks-summary employee-tasks-summary--four">
        <article className="employee-tasks-summary__card">
          <span>Teams</span>
          <strong>{String(teams.length).padStart(2, "0")}</strong>
        </article>
        <article className="employee-tasks-summary__card">
          <span>Managers</span>
          <strong>{String(uniqueManagerCount).padStart(2, "0")}</strong>
        </article>
        <article className="employee-tasks-summary__card">
          <span>Members</span>
          <strong>{String(uniqueMemberCount).padStart(2, "0")}</strong>
        </article>
        <article className="employee-tasks-summary__card">
          <span>Active Members</span>
          <strong>{String(activeMemberCount).padStart(2, "0")}</strong>
        </article>
      </section>

      <section className="manager-dashboard-section">
        <div className="manager-dashboard-section__header">
          <h3>{title}</h3>
        </div>
        {teams.length > 0 ? (
          <div className="team-directory-grid">
            {teams.map((team) => (
              <article key={team.id} className="team-directory-card">
                <div className="team-directory-card__header">
                  <h4>{team.name}</h4>
                  <span className="employee-task-pill">{(team.members ?? []).length} members</span>
                </div>
                <div className="team-directory-card__section">
                  <span className="team-directory-card__label">Managers</span>
                  <p>{(team.managers ?? []).map((manager) => manager.fullName).join(", ") || "Unassigned"}</p>
                </div>
                <div className="team-directory-card__section">
                  <span className="team-directory-card__label">Members</span>
                  <div className="team-member-list">
                    {(team.members ?? []).map((member) => (
                      <div key={member.id} className="team-member-row">
                        <div>
                          <strong>{member.fullName}</strong>
                          <span>{member.email}</span>
                        </div>
                        <span
                          className={
                            member.isActive
                              ? "employee-task-pill employee-task-pill--completed"
                              : "employee-task-pill employee-task-pill--rejected"
                          }
                        >
                          {member.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    ))}
                    {(team.members ?? []).length === 0 ? (
                      <p className="manager-dashboard-inactive">No members in this team yet.</p>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="manager-dashboard-table-card">
            <p className="manager-dashboard-inactive">No teams found for your account.</p>
          </div>
        )}
      </section>
    </div>
  );
};
