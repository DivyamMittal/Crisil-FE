import { ApprovalType, TaskStatus, TimerState } from "./enums";

export const nextStatusForTimerState = (
  currentStatus: TaskStatus,
  timerState: TimerState,
): TaskStatus => {
  if (timerState === TimerState.RUNNING) {
    return TaskStatus.WIP;
  }

  if (
    timerState === TimerState.PAUSED ||
    (timerState === TimerState.STOPPED && currentStatus === TaskStatus.WIP)
  ) {
    return TaskStatus.ON_HOLD;
  }

  return currentStatus;
};

export const requiresApprovalForUpdate = (nextStatus: TaskStatus) =>
  [TaskStatus.APPROVAL_PENDING, TaskStatus.COMPLETED].includes(nextStatus);

export const approvalTypeForStatus = (nextStatus: TaskStatus) => {
  if (nextStatus === TaskStatus.COMPLETED || nextStatus === TaskStatus.APPROVAL_PENDING) {
    return ApprovalType.TASK_COMPLETION;
  }

  return ApprovalType.TASK_UPDATE;
};

