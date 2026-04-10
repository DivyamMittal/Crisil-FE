import { Link, useLocation } from "react-router-dom";

import { useAuth } from "@/features/auth/auth-context";
import { UserRole } from "@/shared";

const getHomeRoute = (role?: UserRole) => {
  if (role === UserRole.ADMIN) {
    return "/admin/users";
  }

  if (role === UserRole.MANAGER) {
    return "/manager/dashboard";
  }

  return "/employee/timesheet";
};

const StatusLayout = ({
  code,
  title,
  description,
}: {
  code: string;
  title: string;
  description: string;
}) => {
  const { user } = useAuth();
  const location = useLocation();
  const homeRoute = getHomeRoute(user?.userRole);
  const attemptedPath =
    typeof location.state === "object" &&
    location.state !== null &&
    "from" in location.state &&
    typeof (location.state as { from?: unknown }).from === "string"
      ? (location.state as { from: string }).from
      : null;

  return (
    <div className="status-screen">
      <div className="status-screen__panel">
        <span className="status-screen__code">{code}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        {attemptedPath ? <div className="status-screen__path">Requested path: {attemptedPath}</div> : null}
        <div className="status-screen__actions">
          <Link className="status-screen__button status-screen__button--primary" to={homeRoute}>
            Go To Dashboard
          </Link>
          <Link className="status-screen__button" to="/">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export const ForbiddenPage = () => (
  <StatusLayout
    code="403"
    title="Access Restricted"
    description="You are signed in, but this page is not available for your role."
  />
);

export const NotFoundPage = () => (
  <StatusLayout
    code="404"
    title="Page Not Found"
    description="The page you tried to open does not exist or may have been moved."
  />
);
