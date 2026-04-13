import { UserRole } from "@/shared";
import { useAuth } from "@/features/auth/auth-context";

import { PortalShell } from "../components/shell";

const LayoutActions = () => {
  const { user, logout } = useAuth();

  return (
    <div className="button-row">
      <span className="muted">{user?.email}</span>
      <button className="button" onClick={logout} type="button">
        Logout
      </button>
    </div>
  );
};

export const EmployeeLayout = () => {
  const { user } = useAuth();

  return (
    <PortalShell
      title="MY TIMESHEET"
      subtitle="Employee Portal"
      navigation={[
        { to: "/employee/timesheet", label: "My Timesheet" },
        { to: "/employee/tasks", label: "My Tasks" },
        { to: "/employee/approvals", label: "Pending Approvals" },
        { to: "/employee/calendar", label: "Calendar" },
      ]}
      footer={`${user?.fullName ?? ""} | ${user?.companyRole ?? ""}`}
      actions={<LayoutActions />}
    />
  );
};

export const ManagerLayout = () => {
  const { user } = useAuth();

  return (
    <PortalShell
      title="DASHBOARD"
      subtitle="Manager Portal"
      navigation={[
        { to: "/manager/dashboard", label: "Dashboard" },
        { to: "/manager/tasks", label: "Tasks" },
        { to: "/manager/projects", label: "Projects" },
        { to: "/manager/team", label: "Team" },
        { to: "/manager/approvals", label: "Approvals" },
        { to: "/manager/calendar", label: "Calendar" },
      ]}
      footer={`${user?.fullName ?? ""} | ${user?.companyRole ?? ""}`}
      actions={<LayoutActions />}
    />
  );
};

export const AdminLayout = () => {
  const { user } = useAuth();

  return (
    <PortalShell
      title="ADMIN"
      subtitle="Administration Portal"
      navigation={[
        { to: "/admin/users", label: "Users" },
        { to: "/admin/calendar", label: "Calendar" },
      ]}
      footer={`${user?.fullName ?? ""} | ${UserRole.ADMIN}`}
      actions={<LayoutActions />}
    />
  );
};
