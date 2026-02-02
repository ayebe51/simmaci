/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as approvalHistory from "../approvalHistory.js";
import type * as archive from "../archive.js";
import type * as auth from "../auth.js";
import type * as cleanup from "../cleanup.js";
import type * as dashboard from "../dashboard.js";
import type * as debugging from "../debugging.js";
import type * as headmaster from "../headmaster.js";
import type * as headmasters from "../headmasters.js";
import type * as importData from "../importData.js";
import type * as listUsers from "../listUsers.js";
import type * as logs from "../logs.js";
import type * as maintenance from "../maintenance.js";
import type * as notifications from "../notifications.js";
import type * as reports from "../reports.js";
import type * as schools from "../schools.js";
import type * as sk from "../sk.js";
import type * as students from "../students.js";
import type * as teachers from "../teachers.js";
import type * as testNotification from "../testNotification.js";
import type * as verification from "../verification.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  approvalHistory: typeof approvalHistory;
  archive: typeof archive;
  auth: typeof auth;
  cleanup: typeof cleanup;
  dashboard: typeof dashboard;
  debugging: typeof debugging;
  headmaster: typeof headmaster;
  headmasters: typeof headmasters;
  importData: typeof importData;
  listUsers: typeof listUsers;
  logs: typeof logs;
  maintenance: typeof maintenance;
  notifications: typeof notifications;
  reports: typeof reports;
  schools: typeof schools;
  sk: typeof sk;
  students: typeof students;
  teachers: typeof teachers;
  testNotification: typeof testNotification;
  verification: typeof verification;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
