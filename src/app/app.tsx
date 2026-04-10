import { useMemo } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";

import { UserRole } from "@/shared";

import { RoleGuard } from "./guard";
import { AdminPage } from "../features/admin/admin-page";
import { LoginPage } from "../features/auth/login-page";
import { EmployeePendingApprovalsPage } from "../features/approvals/employee-pending-approvals";
import { useAuth } from "../features/auth/auth-context";
import { CalendarPage } from "../features/calendar/calendar-page";
import { EmployeeTimesheetPage } from "../features/dashboard/employee-timesheet";
import { ManagerDashboardPage } from "../features/manager/manager-dashboard";
import { ManagerApprovalsPage } from "../features/manager/manager-approvals-page";
import { ManagerProjectsPage } from "../features/manager/manager-projects-page";
import { ManagerTeamPage } from "../features/manager/manager-team-page";
import { ForbiddenPage, NotFoundPage } from "../features/system/status-pages";
import { EmployeeTasksPage } from "../features/tasks/employee-tasks";
import { AdminLayout, EmployeeLayout, ManagerLayout } from "../layouts/role-layouts";

export const App = () => {
  const { user, loading } = useAuth();
  const role = user?.userRole;

  const defaultRoute = useMemo(() => {
    if (role === UserRole.MANAGER) return "/manager/dashboard";
    if (role === UserRole.ADMIN) return "/admin/users";
    return "/employee/timesheet";
  }, [role]);

  if (loading) {
    return <div className="login-page"><div className="card">Loading...</div></div>;
  }

  return (
    <BrowserRouter>
      {!user ? (
        <LoginPage />
      ) : (
      <div className="app-frame">
        <Routes>
          <Route path="/" element={<Navigate to={defaultRoute} replace />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />

          <Route element={<RoleGuard role={role} allowed={[UserRole.EMPLOYEE]} />}>
            <Route path="/employee" element={<EmployeeLayout />}>
              <Route path="timesheet" element={<EmployeeTimesheetPage />} />
              <Route path="tasks" element={<EmployeeTasksPage />} />
              <Route path="approvals" element={<EmployeePendingApprovalsPage />} />
              <Route path="calendar" element={<CalendarPage />} />
            </Route>
          </Route>

          <Route element={<RoleGuard role={role} allowed={[UserRole.MANAGER]} />}>
            <Route path="/manager" element={<ManagerLayout />}>
              <Route path="dashboard" element={<ManagerDashboardPage />} />
              <Route path="projects" element={<ManagerProjectsPage />} />
              <Route path="team" element={<ManagerTeamPage />} />
              <Route path="approvals" element={<ManagerApprovalsPage />} />
              <Route path="calendar" element={<CalendarPage />} />
            </Route>
          </Route>

          <Route element={<RoleGuard role={role} allowed={[UserRole.ADMIN]} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="users" element={<AdminPage title="User Management" />} />
              <Route path="calendar" element={<CalendarPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
      )}
    </BrowserRouter>
  );
};
