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
import type * as clean_teachers from "../clean_teachers.js";
import type * as cleanup from "../cleanup.js";
import type * as dashboard from "../dashboard.js";
import type * as debug from "../debug.js";
import type * as debug_actions from "../debug_actions.js";
import type * as debug_check from "../debug_check.js";
import type * as debug_data from "../debug_data.js";
import type * as debug_final from "../debug_final.js";
import type * as debug_find_admin from "../debug_find_admin.js";
import type * as debug_find_email from "../debug_find_email.js";
import type * as debug_insert from "../debug_insert.js";
import type * as debug_inspect from "../debug_inspect.js";
import type * as debug_logs from "../debug_logs.js";
import type * as debug_public from "../debug_public.js";
import type * as debug_school_check from "../debug_school_check.js";
import type * as debug_simple from "../debug_simple.js";
import type * as debug_sk from "../debug_sk.js";
import type * as debug_sk_stats from "../debug_sk_stats.js";
import type * as debug_status from "../debug_status.js";
import type * as debug_tables from "../debug_tables.js";
import type * as debug_users from "../debug_users.js";
import type * as debug_visibility from "../debug_visibility.js";
import type * as debugging from "../debugging.js";
import type * as diagnose_data from "../diagnose_data.js";
import type * as diagnose_regression from "../diagnose_regression.js";
import type * as diagnose_simple from "../diagnose_simple.js";
import type * as drive from "../drive.js";
import type * as files from "../files.js";
import type * as fix_data from "../fix_data.js";
import type * as fix_data_integrity from "../fix_data_integrity.js";
import type * as fix_kroya_atomic from "../fix_kroya_atomic.js";
import type * as fix_school_names from "../fix_school_names.js";
import type * as fix_visibility from "../fix_visibility.js";
import type * as headmaster from "../headmaster.js";
import type * as headmasters from "../headmasters.js";
import type * as http from "../http.js";
import type * as importData from "../importData.js";
import type * as logs from "../logs.js";
import type * as maintenance from "../maintenance.js";
import type * as migrations from "../migrations.js";
import type * as mutations from "../mutations.js";
import type * as my_diagnosis from "../my_diagnosis.js";
import type * as notifications from "../notifications.js";
import type * as reports from "../reports.js";
import type * as reproduce_bulk from "../reproduce_bulk.js";
import type * as schools from "../schools.js";
import type * as settings from "../settings.js";
import type * as settings_cloud from "../settings_cloud.js";
import type * as simple_debug from "../simple_debug.js";
import type * as sk from "../sk.js";
import type * as sk_new from "../sk_new.js";
import type * as students from "../students.js";
import type * as teachers from "../teachers.js";
import type * as testNotification from "../testNotification.js";
import type * as utils from "../utils.js";
import type * as verification from "../verification.js";
import type * as verify_migration from "../verify_migration.js";

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
  clean_teachers: typeof clean_teachers;
  cleanup: typeof cleanup;
  dashboard: typeof dashboard;
  debug: typeof debug;
  debug_actions: typeof debug_actions;
  debug_check: typeof debug_check;
  debug_data: typeof debug_data;
  debug_final: typeof debug_final;
  debug_find_admin: typeof debug_find_admin;
  debug_find_email: typeof debug_find_email;
  debug_insert: typeof debug_insert;
  debug_inspect: typeof debug_inspect;
  debug_logs: typeof debug_logs;
  debug_public: typeof debug_public;
  debug_school_check: typeof debug_school_check;
  debug_simple: typeof debug_simple;
  debug_sk: typeof debug_sk;
  debug_sk_stats: typeof debug_sk_stats;
  debug_status: typeof debug_status;
  debug_tables: typeof debug_tables;
  debug_users: typeof debug_users;
  debug_visibility: typeof debug_visibility;
  debugging: typeof debugging;
  diagnose_data: typeof diagnose_data;
  diagnose_regression: typeof diagnose_regression;
  diagnose_simple: typeof diagnose_simple;
  drive: typeof drive;
  files: typeof files;
  fix_data: typeof fix_data;
  fix_data_integrity: typeof fix_data_integrity;
  fix_kroya_atomic: typeof fix_kroya_atomic;
  fix_school_names: typeof fix_school_names;
  fix_visibility: typeof fix_visibility;
  headmaster: typeof headmaster;
  headmasters: typeof headmasters;
  http: typeof http;
  importData: typeof importData;
  logs: typeof logs;
  maintenance: typeof maintenance;
  migrations: typeof migrations;
  mutations: typeof mutations;
  my_diagnosis: typeof my_diagnosis;
  notifications: typeof notifications;
  reports: typeof reports;
  reproduce_bulk: typeof reproduce_bulk;
  schools: typeof schools;
  settings: typeof settings;
  settings_cloud: typeof settings_cloud;
  simple_debug: typeof simple_debug;
  sk: typeof sk;
  sk_new: typeof sk_new;
  students: typeof students;
  teachers: typeof teachers;
  testNotification: typeof testNotification;
  utils: typeof utils;
  verification: typeof verification;
  verify_migration: typeof verify_migration;
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
