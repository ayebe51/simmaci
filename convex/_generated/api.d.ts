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
import type * as archives from "../archives.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as auth_helpers from "../auth_helpers.js";
import type * as cleanup from "../cleanup.js";
import type * as dashboard from "../dashboard.js";
import type * as debug from "../debug.js";
import type * as debug_check from "../debug_check.js";
import type * as debug_inspect from "../debug_inspect.js";
import type * as debug_sk_stats from "../debug_sk_stats.js";
import type * as debug_status from "../debug_status.js";
import type * as debugging from "../debugging.js";
import type * as files from "../files.js";
import type * as headmaster from "../headmaster.js";
import type * as headmasters from "../headmasters.js";
import type * as importData from "../importData.js";
import type * as logs from "../logs.js";
import type * as maintenance from "../maintenance.js";
import type * as migrations from "../migrations.js";
import type * as mutations from "../mutations.js";
import type * as notifications from "../notifications.js";
import type * as reports from "../reports.js";
import type * as reproduce_bulk from "../reproduce_bulk.js";
import type * as schools from "../schools.js";
import type * as settings from "../settings.js";
import type * as settings_cloud from "../settings_cloud.js";
import type * as settings_tenant from "../settings_tenant.js";
import type * as sk from "../sk.js";
import type * as students from "../students.js";
import type * as teachers from "../teachers.js";
import type * as testNotification from "../testNotification.js";
import type * as utils from "../utils.js";
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
  archives: typeof archives;
  audit: typeof audit;
  auth: typeof auth;
  auth_helpers: typeof auth_helpers;
  cleanup: typeof cleanup;
  dashboard: typeof dashboard;
  debug: typeof debug;
  debug_check: typeof debug_check;
  debug_inspect: typeof debug_inspect;
  debug_sk_stats: typeof debug_sk_stats;
  debug_status: typeof debug_status;
  debugging: typeof debugging;
  files: typeof files;
  headmaster: typeof headmaster;
  headmasters: typeof headmasters;
  importData: typeof importData;
  logs: typeof logs;
  maintenance: typeof maintenance;
  migrations: typeof migrations;
  mutations: typeof mutations;
  notifications: typeof notifications;
  reports: typeof reports;
  reproduce_bulk: typeof reproduce_bulk;
  schools: typeof schools;
  settings: typeof settings;
  settings_cloud: typeof settings_cloud;
  settings_tenant: typeof settings_tenant;
  sk: typeof sk;
  students: typeof students;
  teachers: typeof teachers;
  testNotification: typeof testNotification;
  utils: typeof utils;
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
