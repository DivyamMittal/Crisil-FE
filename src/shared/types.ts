import {
  ApprovalStatus,
  ApprovalType,
  CommentVisibility,
  CompanyRole,
  Priority,
  ProjectStatus,
  TaskStatus,
  TimeEntryType,
  TimerState,
  UserRole,
} from "./enums";

export type EntityId = string;

export interface BaseEntity {
  id: EntityId;
  createdAt: string;
  updatedAt: string;
}

export interface User extends BaseEntity {
  email: string;
  fullName: string;
  userRole: UserRole;
  companyRole: CompanyRole;
  managerId?: EntityId | null;
  isActive: boolean;
  timezone: string;
  lastLoginAt?: string | null;
}

export interface Project extends BaseEntity {
  code: string;
  name: string;
  description: string;
  managerId: EntityId;
  status: ProjectStatus;
  startDateUtc: string;
  targetEndDateUtc: string;
}

export interface Activity extends BaseEntity {
  projectId: EntityId;
  name: string;
  description: string;
  status: ProjectStatus;
  createdBy: EntityId;
}

export interface Task extends BaseEntity {
  projectId: EntityId;
  activityId: EntityId;
  title: string;
  description: string;
  assigneeId: EntityId;
  createdByManagerId: EntityId;
  priority: Priority;
  status: TaskStatus;
  estimatedHours: number;
  loggedMinutes: number;
  dueDateUtc: string;
  startedAtUtc?: string | null;
  completedAtUtc?: string | null;
  approvalPendingSinceUtc?: string | null;
  rejectionReason?: string | null;
  lastTimerEntryId?: EntityId | null;
}

export interface TimeEntry extends BaseEntity {
  taskId: EntityId;
  employeeId: EntityId;
  projectId: EntityId;
  activityId: EntityId;
  entryType: TimeEntryType;
  timerState: TimerState;
  startTimeUtc: string;
  endTimeUtc?: string | null;
  durationSeconds: number;
  durationMinutes: number;
  description: string;
  isSubmittedForApproval: boolean;
  approvalRequestId?: EntityId | null;
}

export interface ApprovalRequest extends BaseEntity {
  type: ApprovalType;
  taskId: EntityId;
  timeEntryId?: EntityId | null;
  requestedBy: EntityId;
  reviewedBy?: EntityId | null;
  status: ApprovalStatus;
  reason: string;
  managerComment?: string | null;
  payload: Record<string, unknown>;
  requestedAtUtc: string;
  reviewedAtUtc?: string | null;
}

export interface Comment extends BaseEntity {
  taskId: EntityId;
  authorId: EntityId;
  body: string;
  visibility: CommentVisibility;
}

export interface Holiday extends BaseEntity {
  title: string;
  dateUtc: string;
  createdByManagerId: EntityId;
  appliesTo?: EntityId[];
}

export interface DashboardStat {
  label: string;
  value: string;
  helper: string;
}

export interface EmployeeTimesheetSnapshot {
  activeTask?: Task;
  todayEntries: TimeEntry[];
  utilizationCards: DashboardStat[];
}

export interface ManagerDashboardSnapshot {
  headlineStats: DashboardStat[];
  liveActivity: Array<{
    memberName: string;
    project: string;
    activity: string;
    task: string;
    status: TaskStatus;
    timeToday: string;
  }>;
  pendingApprovals: ApprovalRequest[];
}
