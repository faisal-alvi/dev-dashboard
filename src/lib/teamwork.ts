/**
 * Teamwork v1 API client.
 *
 * Authentication: HTTP Basic with API key as username, anything as password.
 * We use Bearer for cleaner browser semantics — Teamwork supports both.
 *
 * Base URL is fueled.teamwork.com. If a different workspace is needed later,
 * make this configurable in Settings.
 */

import { getToken } from './tokens';

const BASE_URL = 'https://fueled.teamwork.com';

class TeamworkError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function tw<T>(path: string): Promise<T> {
  const token = getToken('teamwork');
  if (!token) throw new TeamworkError('Teamwork token not configured', 401);
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new TeamworkError(`Teamwork ${res.status} on ${path}`, res.status);
  }
  return res.json();
}

export interface TeamworkUser {
  id: string;
  'first-name': string;
  'last-name': string;
  'email-address': string;
  'avatar-url': string;
}

interface MeResponse {
  person: TeamworkUser;
}

export async function getCurrentUser(): Promise<TeamworkUser> {
  const data = await tw<MeResponse>('/me.json');
  return data.person;
}

export interface TimeEntry {
  id: string;
  date: string;
  hours: string;
  minutes: string;
  description: string;
  'project-id': string;
  'project-name': string;
  'user-id': string;
  'isbillable': string;
  'task-id'?: string;
  'task-name'?: string;
}

interface TimeEntriesResponse {
  'time-entries': TimeEntry[];
}

/**
 * Fetch time entries for the current user between two dates (inclusive).
 * Dates must be YYYYMMDD (Teamwork v1 quirk).
 */
export async function getMyTimeEntries(
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<TimeEntry[]> {
  const data = await tw<TimeEntriesResponse>(
    `/time_entries.json?userId=${userId}&fromdate=${fromDate}&todate=${toDate}&pageSize=500`,
  );
  return data['time-entries'] ?? [];
}

/** Convert a TimeEntry to decimal hours. */
export function entryToHours(entry: TimeEntry): number {
  return Number(entry.hours) + Number(entry.minutes) / 60;
}

/** Sum hours across an array of entries. */
export function sumHours(entries: TimeEntry[]): number {
  return entries.reduce((acc, e) => acc + entryToHours(e), 0);
}

/** Group entries by project name and sum hours per project. */
export function hoursByProject(
  entries: TimeEntry[],
): Array<{ project: string; hours: number; billable: number }> {
  const map = new Map<string, { hours: number; billable: number }>();
  for (const e of entries) {
    const key = e['project-name'] || 'Unknown';
    const h = entryToHours(e);
    const b = e.isbillable === '1' ? h : 0;
    const current = map.get(key) ?? { hours: 0, billable: 0 };
    map.set(key, { hours: current.hours + h, billable: current.billable + b });
  }
  return Array.from(map.entries())
    .map(([project, v]) => ({ project, ...v }))
    .sort((a, b) => b.hours - a.hours);
}

/** Format a Date as YYYYMMDD for Teamwork v1 endpoints. */
export function teamworkDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** Get start of the current week (Monday, local time). */
export function weekStart(d = new Date()): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Get end of the current week (Sunday, local time). */
export function weekEnd(d = new Date()): Date {
  const start = weekStart(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}
