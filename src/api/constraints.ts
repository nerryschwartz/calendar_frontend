import { apiDelete, apiPost, apiPut } from "./client";
import type {
  TimeConstraintGroupDTO,
  UserGroupBody,
  UserWindowBody,
} from "./types";

export function addUserConstraintGroup(
  planId: string,
  body: UserGroupBody,
): Promise<TimeConstraintGroupDTO> {
  return apiPost<TimeConstraintGroupDTO>(
    `/api/plans/${planId}/constraints/groups`,
    body,
  );
}

export function updateUserConstraintGroup(
  groupId: string,
  body: UserGroupBody,
): Promise<TimeConstraintGroupDTO> {
  return apiPut<TimeConstraintGroupDTO>(
    `/api/constraints/groups/${groupId}/windows`,
    body,
  );
}

export function removeUserConstraintGroup(
  groupId: string,
): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(`/api/constraints/groups/${groupId}`);
}

export function addUserWindow(
  groupId: string,
  body: UserWindowBody,
): Promise<TimeConstraintGroupDTO> {
  return apiPost<TimeConstraintGroupDTO>(
    `/api/constraints/groups/${groupId}/windows`,
    body,
  );
}

export function removeUserWindow(
  groupId: string,
  windowId: string,
): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(
    `/api/constraints/groups/${groupId}/windows/${windowId}`,
  );
}
