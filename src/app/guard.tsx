import { Navigate, Outlet, useLocation } from "react-router-dom";

import { UserRole } from "@/shared";

export const RoleGuard = ({
  role,
  allowed,
}: {
  role?: UserRole;
  allowed: UserRole[];
}) => {
  const location = useLocation();

  if (!role || !allowed.includes(role)) {
    return <Navigate to="/forbidden" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};
