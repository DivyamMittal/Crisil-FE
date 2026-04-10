export enum UserRole {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  EMPLOYEE = "EMPLOYEE",
}

export enum CompanyRole {
  DEVELOPER = "DEVELOPER",
  ANALYST = "ANALYST",
  EDITOR = "EDITOR",
  QA = "QA",
  MANAGER = "MANAGER",
  OTHER = "OTHER",
}

export enum TaskStatus {
  PENDING = "PENDING",
  WIP = "WIP",
  ON_HOLD = "ON_HOLD",
  APPROVAL_PENDING = "APPROVAL_PENDING",
  REJECTED = "REJECTED",
  COMPLETED = "COMPLETED",
}

export enum ApprovalType {
  MANUAL_LOG = "MANUAL_LOG",
  TASK_UPDATE = "TASK_UPDATE",
  TASK_COMPLETION = "TASK_COMPLETION",
  DUE_DATE_CHANGE = "DUE_DATE_CHANGE",
}

export enum ApprovalStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum TimerState {
  RUNNING = "RUNNING",
  PAUSED = "PAUSED",
  STOPPED = "STOPPED",
}

export enum ProjectStatus {
  ACTIVE = "ACTIVE",
  ON_HOLD = "ON_HOLD",
  COMPLETED = "COMPLETED",
  ARCHIVED = "ARCHIVED",
}

export enum Priority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum TimeEntryType {
  TIMER = "TIMER",
  MANUAL = "MANUAL",
}

export enum CommentVisibility {
  INTERNAL = "INTERNAL",
  SHARED = "SHARED",
}
