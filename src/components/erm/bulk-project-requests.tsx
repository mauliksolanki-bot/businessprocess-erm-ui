"use client";

import { type ChangeEvent, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, ShieldX, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ApiError,
  getProjectDeliveryManagerOptions,
  getProjectDirectorOptions,
  getProjectHrOptions,
  getProjectManagerOptions,
  getProjectOwnerOptions,
  submitBulkProjectRequests,
  validateBulkProjectRequests,
  type ProjectBulkRow,
  type ProjectBulkValidationError,
  type ProjectManagerOption,
  type ProjectHrOption,
  type ProjectStatus,
} from "@/lib/api";
import { loadSession } from "@/lib/auth-storage";

const MAX_ROWS = 10000;
const BATCH_SIZE = 20;
const PROJECT_TYPES = ["Internal", "Billable", "Fixed Bid", "T&M"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const PROJECT_STATUSES = ["Planned", "Active", "On Hold", "Completed", "Cancelled"];

const columns = [
  { key: "projectName", header: "Project Name *", width: 30 },
  { key: "projectCode", header: "Project Code *", width: 20 },
  { key: "clientName", header: "Client Name *", width: 26 },
  { key: "projectType", header: "Project Type *", width: 18 },
  { key: "priority", header: "Priority *", width: 16 },
  { key: "plannedStartDate", header: "Planned Start Date *", width: 20 },
  { key: "plannedEndDate", header: "Planned End Date *", width: 20 },
  { key: "budgetAmount", header: "Budget Amount *", width: 20 },
  { key: "currency", header: "Currency *", width: 14 },
  { key: "deliveryManagerUsername", header: "Delivery Manager Username *", width: 32 },
  { key: "projectOwnerUsername", header: "Project Owner Username *", width: 30 },
  { key: "projectDirectorUsername", header: "Project Director Username *", width: 30 },
  { key: "projectManagerUsername", header: "Project Manager Username *", width: 30 },
  { key: "hrbpUsername", header: "HRBP Username *", width: 26 },
  { key: "projectStatus", header: "Project Status *", width: 18 },
  { key: "description", header: "Description *", width: 48 },
  { key: "riskNotes", header: "Risk Notes", width: 40 },
  { key: "comment", header: "Comment", width: 36 },
] as const;

type SaveProgress = { processed: number; total: number; batch: number; totalBatches: number; status: "saving" | "paused" | "complete"; message?: string };

function readCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (typeof value === "object") {
    const cell = value as { text?: unknown; richText?: Array<{ text?: unknown }>; result?: unknown };
    if (typeof cell.text === "string") return cell.text.trim();
    if (Array.isArray(cell.richText)) return cell.richText.map((part) => String(part.text ?? "")).join("").trim();
    if (cell.result !== undefined && cell.result !== null) return String(cell.result).trim();
  }
  return "";
}

function resolveUserId(value: string, options: ProjectManagerOption[]) {
  const match = options.find((option) => option.username.toLowerCase() === value.trim().toLowerCase());
  return match?.id ?? null;
}

function findCrossBatchDuplicates(rows: ProjectBulkRow[], batchSize: number): ProjectBulkValidationError[] {
  const errors: ProjectBulkValidationError[] = [];
  const fields = [
    { field: "Project Code", value: (row: ProjectBulkRow) => row.project.projectCode },
    { field: "Project Name", value: (row: ProjectBulkRow) => row.project.projectName },
  ];
  for (const { field, value } of fields) {
    const firstRow = new Map<string, number>();
    rows.forEach((row, index) => {
      const normalized = value(row).trim().toLowerCase();
      if (!normalized) return;
      const previous = firstRow.get(normalized);
      if (previous !== undefined && Math.floor(previous / batchSize) !== Math.floor(index / batchSize)) {
        errors.push({ rowNumber: row.rowNumber, field, message: `Duplicates the value in row ${rows[previous].rowNumber} of this file.` });
      } else if (previous === undefined) firstRow.set(normalized, index);
    });
  }
  return errors;
}

export function BulkProjectRequests({ accessToken, onSubmitted }: { accessToken: () => string | null; onSubmitted: () => void }) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ProjectBulkRow[] | null>(null);
  const [validation, setValidation] = useState<{ valid: boolean; errors: ProjectBulkValidationError[] } | null>(null);
  const [reading, setReading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState<{ completed: number; total: number } | null>(null);
  const [saveProgress, setSaveProgress] = useState<SaveProgress | null>(null);

  async function downloadTemplate() {
    const token = accessToken();
    if (!token) return;
    setDownloading(true);
    try {
      const [deliveryManagers, projectOwners, directors, managers, hrbps] = await Promise.all([
        getProjectDeliveryManagerOptions(token), getProjectOwnerOptions(token), getProjectDirectorOptions(token),
        getProjectManagerOptions(token), getProjectHrOptions(token),
      ]);
      const currentUsername = loadSession()?.username?.toLowerCase();
      const ownProjectOwner = projectOwners.filter((user) => user.username.toLowerCase() === currentUsername);
      if (ownProjectOwner.length !== 1) throw new Error("Your Project Owner account could not be found in the current project owner list.");
      const { Workbook } = await import("exceljs");
      const workbook = new Workbook();
      workbook.creator = "ERM";
      workbook.created = new Date();
      const sheet = workbook.addWorksheet("Project Requests", { views: [{ state: "frozen", ySplit: 1 }] });
      sheet.columns = columns.map((column) => ({ header: column.header, key: column.key, width: column.width }));
      sheet.autoFilter = { from: "A1", to: "R" + (MAX_ROWS + 1) };
      sheet.getRow(1).height = 34;
      sheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF243B73" } };
        cell.alignment = { vertical: "middle", wrapText: true };
      });
      const options = workbook.addWorksheet("Options");
      options.state = "veryHidden";
      const dropdowns: Array<{ name: string; title: string; values: string[] }> = [
        { name: "ProjectTypes", title: "Project Types", values: PROJECT_TYPES },
        { name: "Priorities", title: "Priorities", values: PRIORITIES },
        { name: "ProjectStatuses", title: "Project Statuses", values: PROJECT_STATUSES },
        { name: "DeliveryManagers", title: "Delivery Managers", values: deliveryManagers.map((user) => user.username) },
        { name: "ProjectOwners", title: "Project Owners", values: ownProjectOwner.map((user) => user.username) },
        { name: "ProjectDirectors", title: "Project Directors", values: directors.map((user) => user.username) },
        { name: "ProjectManagers", title: "Project Managers", values: managers.map((user) => user.username) },
        { name: "HRBPs", title: "HRBPs", values: hrbps.map((user) => user.username) },
      ];
      dropdowns.forEach((list, index) => {
        const column = index + 1;
        const letter = String.fromCharCode(65 + index);
        options.getCell(1, column).value = list.title;
        options.getCell(1, column).font = { bold: true };
        const values = ["Select option", ...[...new Set(list.values.filter(Boolean))].sort((a, b) => a.localeCompare(b))];
        values.forEach((value, row) => { options.getCell(row + 2, column).value = value; });
        workbook.definedNames.add(`'Options'!$${letter}$2:$${letter}$${values.length + 1}`, list.name);
      });
      const instructions = workbook.addWorksheet("Instructions");
      instructions.columns = [{ width: 120 }];
      instructions.addRows([
        ["Bulk Project Request Template"],
        ["Enter one project request per row. Do not rename or reorder columns in Project Requests."],
        ["Columns marked * are required. Dates must be valid dates, budget must be positive, and project code must use 3-30 uppercase letters, numbers, or hyphens."],
        ["Choose values from dropdowns. The employee username dropdown values are refreshed from the database each time the template is downloaded."],
        ["The selected Project Owner must be your own Project Owner account. Each project needs an active Delivery Manager, Director, Project Manager, and HRBP (Junior HR, Senior HR, or HR Head)."],
        ["Project name and project code must be unique in the workbook and among existing project requests. Type, priority, status, dates, budget, currency, descriptions, and role assignments are checked before submission."],
        [`Up to ${MAX_ROWS.toLocaleString("en-IN")} projects are accepted per workbook and saved in batches of ${BATCH_SIZE}. Each row creates a separate project request for the existing approval workflow.`],
      ]);
      instructions.getRow(1).font = { bold: true, size: 16, color: { argb: "FF243B73" } };
      instructions.getColumn(1).alignment = { wrapText: true, vertical: "middle" };
      instructions.eachRow((row) => { row.height = 34; });
      const validations: Array<[number, string]> = [
        [4, "ProjectTypes"], [5, "Priorities"], [10, "DeliveryManagers"], [11, "ProjectOwners"],
        [12, "ProjectDirectors"], [13, "ProjectManagers"], [14, "HRBPs"], [15, "ProjectStatuses"],
      ];
      for (let rowNumber = 2; rowNumber <= MAX_ROWS + 1; rowNumber++) {
        for (const [column, range] of validations) {
          sheet.getCell(rowNumber, column).dataValidation = {
            type: "list", allowBlank: true, formulae: [`=${range}`], showErrorMessage: true,
            errorTitle: "Choose a current option", error: "Select a value from the dropdown list.",
          };
        }
        for (const column of [6, 7]) sheet.getCell(rowNumber, column).numFmt = "yyyy-mm-dd";
        sheet.getCell(rowNumber, 8).numFmt = "0.00";
        if (rowNumber % 2 === 0) for (let column = 1; column <= columns.length; column++) {
          sheet.getCell(rowNumber, column).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F8FF" } };
        }
      }
      const content = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([content as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "project-request-template.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Latest project request template downloaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download the project template.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setRows(null);
    setFileName(file?.name ?? "");
    setValidation(null);
    setSaveProgress(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) { toast.error("Upload the downloaded .xlsx project template."); setFileName(""); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error("The workbook must be smaller than 15 MB."); setFileName(""); return; }
    setReading(true);
    try {
      const { Workbook } = await import("exceljs");
      const workbook = new Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.getWorksheet("Project Requests");
      if (!sheet) throw new Error("The workbook is missing the Project Requests sheet.");
      const expectedHeaders = columns.map((column) => column.header.replaceAll("*", "").trim().toLowerCase());
      const actualHeaders = columns.map((_, index) => readCell(sheet.getCell(1, index + 1).value).replaceAll("*", "").trim().toLowerCase());
      if (expectedHeaders.some((header, index) => header !== actualHeaders[index])) throw new Error("The spreadsheet columns do not match the downloaded project request template.");
      if (sheet.rowCount > MAX_ROWS + 1) throw new Error(`A maximum of ${MAX_ROWS.toLocaleString("en-IN")} project rows can be uploaded at once.`);
      const token = accessToken();
      if (!token) return;
      const [deliveryManagers, projectOwners, directors, managers, hrbps] = await Promise.all([
        getProjectDeliveryManagerOptions(token), getProjectOwnerOptions(token), getProjectDirectorOptions(token),
        getProjectManagerOptions(token), getProjectHrOptions(token),
      ]);
      const parsed: ProjectBulkRow[] = [];
      const mappingErrors: ProjectBulkValidationError[] = [];
      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
        const values = columns.map((_, index) => readCell(sheet.getCell(rowNumber, index + 1).value));
        if (values.every((value) => !value)) continue;
        const [projectName, projectCode, clientName, projectType, priority, plannedStartDate, plannedEndDate, budgetText, currency, dmUsername, ownerUsername, directorUsername, pmUsername, hrbpUsername, projectStatus, description, riskNotes, comment] = values;
        const lookup = (username: string, choices: Array<ProjectManagerOption | ProjectHrOption>) => resolveUserId(username, choices);
        const roleIds = {
          dm: lookup(dmUsername, deliveryManagers), owner: lookup(ownerUsername, projectOwners), director: lookup(directorUsername, directors),
          pm: lookup(pmUsername, managers), hrbp: lookup(hrbpUsername, hrbps),
        };
        parsed.push({ rowNumber, project: {
          projectName, projectCode: projectCode.toUpperCase(), clientName, projectType, priority, plannedStartDate, plannedEndDate,
          budgetAmount: Number(budgetText), currency: currency.toUpperCase(), deliveryManagerUserId: roleIds.dm ?? 0,
          projectOwnerUserId: roleIds.owner ?? 0, projectDirectorUserId: roleIds.director ?? 0,
          projectManagerUserId: roleIds.pm ?? 0, associatedHrUserId: roleIds.hrbp ?? 0, projectStatus: projectStatus as ProjectStatus,
          description, riskNotes: riskNotes || undefined, comment: comment || undefined,
        } });
        const labels: Record<string, string> = { dm: "Delivery Manager Username", owner: "Project Owner Username", director: "Project Director Username", pm: "Project Manager Username", hrbp: "HRBP Username" };
        Object.entries(roleIds).filter(([, id]) => id === null).forEach(([field]) => {
          mappingErrors.push({ rowNumber, field: labels[field], message: "Select a current username from the template dropdown." });
        });
      }
      if (parsed.length === 0) throw new Error("The workbook has no project rows to validate.");
      setRows(parsed);
      if (mappingErrors.length) setValidation({ valid: false, errors: mappingErrors });
      toast.success(`${parsed.length.toLocaleString("en-IN")} project row(s) ready to validate.`);
    } catch (error) {
      setFileName("");
      toast.error(error instanceof Error ? error.message : "Unable to read the project workbook.");
    } finally { setReading(false); }
  }

  async function validateFile() {
    const token = accessToken();
    if (!token || !rows) return;
    setValidating(true);
    setValidation(null);
    setSaveProgress(null);
    setValidationProgress({ completed: 0, total: rows.length });
    try {
      const errors: ProjectBulkValidationError[] = [];
      for (let start = 0; start < rows.length; start += BATCH_SIZE) {
        const result = await validateBulkProjectRequests(token, rows.slice(start, start + BATCH_SIZE));
        errors.push(...result.errors);
        setValidationProgress({ completed: Math.min(start + BATCH_SIZE, rows.length), total: rows.length });
      }
      errors.push(...findCrossBatchDuplicates(rows, BATCH_SIZE));
      const result = { valid: errors.length === 0, errors };
      setValidation(result);
      toast[result.valid ? "success" : "error"](result.valid ? "Validation has been passed!" : `Validation has been failed. ${errors.length} issue(s) found.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to validate the project workbook.");
    } finally { setValidating(false); }
  }

  async function submitFile() {
    const token = accessToken();
    if (!token || !rows || !validation?.valid) return;
    let processed = saveProgress?.processed ?? 0;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
    setSaveProgress({ processed, total: rows.length, batch: Math.floor(processed / BATCH_SIZE) + 1, totalBatches, status: "saving" });
    try {
      for (let start = processed; start < rows.length; start += BATCH_SIZE) {
        const batch = rows.slice(start, start + BATCH_SIZE);
        const response = await submitBulkProjectRequests(token, batch);
        if (!response.submitted) {
          setValidation({ valid: false, errors: response.errors });
          throw new Error("A batch no longer passes server validation. Correct the workbook and validate it again.");
        }
        processed = start + batch.length;
        setSaveProgress({ processed, total: rows.length, batch: Math.floor(start / BATCH_SIZE) + 1, totalBatches, status: processed === rows.length ? "complete" : "saving" });
      }
      setSaveProgress({ processed: rows.length, total: rows.length, batch: totalBatches, totalBatches, status: "complete" });
      toast.success(`${rows.length.toLocaleString("en-IN")} project request(s) created.`);
      onSubmitted();
    } catch (error) {
      const message = error instanceof ApiError ? `The current batch failed (${error.status}). Earlier confirmed batches are saved; you can resume.` : error instanceof Error ? error.message : "Project creation paused.";
      setSaveProgress({ processed, total: rows.length, batch: Math.floor(processed / BATCH_SIZE) + 1, totalBatches, status: "paused", message });
      toast.error(message);
    }
  }

  return <Card className="mb-6 overflow-hidden border-indigo-100 shadow-md shadow-indigo-100/40">
    <CardHeader className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white">
      <CardTitle className="flex items-center gap-2 text-white"><FileSpreadsheet className="h-5 w-5" /> Bulk Project Requests</CardTitle>
      <CardDescription className="text-indigo-50">Create multiple project requests in one workbook. Every row follows the same validation and approval rules as an individual project request.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-5 pt-6">
      <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
        <div><p className="text-sm font-semibold text-zinc-900">1. Prepare the workbook</p><p className="mt-1 text-sm text-zinc-600">Dropdowns use current active project roles and HRBP options from the database. Download a fresh template before each upload.</p></div>
        <Button disabled={downloading} onClick={() => void downloadTemplate()} variant="outline">{downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}{downloading ? "Preparing template..." : "Download Excel template"}</Button>
        <label className={`inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-100 ${reading ? "pointer-events-none opacity-60" : ""}`}>{reading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{reading ? "Reading workbook..." : "Upload completed workbook"}<input accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={reading || validating || saveProgress?.status === "saving"} onChange={(event) => void handleFileChange(event)} type="file" /></label>
        {fileName ? <p className="text-xs text-zinc-500 lg:col-span-3">Selected file: <span className="font-medium text-zinc-700">{fileName}</span>{rows ? ` · ${rows.length.toLocaleString("en-IN")} project row(s)` : ""}</p> : null}
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-semibold text-zinc-900">2. Validate and submit</p><p className="mt-1 text-sm text-zinc-600">Checks required fields, formats, dates, duplicate names/codes, active role assignments, HRBP, and Project Owner authorization.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!rows || validating || saveProgress?.status === "saving"} onClick={() => void validateFile()} variant="outline">{validating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{validating ? "Validating..." : "Validate workbook"}</Button>
          <Button disabled={!validation?.valid || validating || saveProgress?.status === "saving" || saveProgress?.status === "complete"} onClick={() => void submitFile()}>{saveProgress?.status === "saving" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{saveProgress?.status === "saving" ? `Saving ${saveProgress.processed.toLocaleString("en-IN")}/${saveProgress.total.toLocaleString("en-IN")}` : saveProgress?.status === "paused" ? "Resume saving remaining" : "Submit all requests"}</Button>
        </div>
      </div>
      {validating && validationProgress ? <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4" role="status" aria-live="polite"><div className="flex justify-between gap-3 text-sm"><span className="font-medium text-blue-950">Validating project requests in batches</span><span className="tabular-nums text-blue-800">{validationProgress.completed.toLocaleString("en-IN")} / {validationProgress.total.toLocaleString("en-IN")} rows</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-[width]" style={{ width: `${validationProgress.completed / Math.max(1, validationProgress.total) * 100}%` }} /></div></div> : null}
      {saveProgress ? <div className={`rounded-xl border p-4 ${saveProgress.status === "complete" ? "border-emerald-200 bg-emerald-50" : saveProgress.status === "paused" ? "border-amber-200 bg-amber-50" : "border-indigo-200 bg-indigo-50"}`} role="status" aria-live="polite"><div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-semibold text-zinc-900">{saveProgress.status === "complete" ? "All project requests saved" : saveProgress.status === "paused" ? "Batch saving paused" : "Saving project requests"}</span><span className="font-medium tabular-nums text-zinc-700">{saveProgress.processed.toLocaleString("en-IN")} / {saveProgress.total.toLocaleString("en-IN")} saved</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-black/5"><div className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-500 transition-[width]" style={{ width: `${saveProgress.processed / Math.max(1, saveProgress.total) * 100}%` }} /></div><div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-zinc-600"><span>{saveProgress.status !== "complete" ? `Batch ${Math.min(saveProgress.batch, saveProgress.totalBatches)} of ${saveProgress.totalBatches} · ${BATCH_SIZE} records per batch` : "Each row is now in the project approval workflow."}</span></div>{saveProgress.message ? <p className="mt-2 text-sm text-amber-900">{saveProgress.message}</p> : null}</div> : null}
      {validation ? <div className={`rounded-2xl border p-4 ${validation.valid ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}><div className="flex items-center gap-2">{validation.valid ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <ShieldX className="h-5 w-5 text-rose-600" />}<p className={`font-semibold ${validation.valid ? "text-emerald-800" : "text-rose-800"}`}>{validation.valid ? "Validation has been passed!" : "Validation has been failed"}</p></div>{validation.valid ? <p className="mt-1 text-sm text-emerald-700">All {rows?.length.toLocaleString("en-IN")} row(s) are valid and ready to submit.</p> : <><p className="mt-1 text-sm text-rose-700">{validation.errors.length.toLocaleString("en-IN")} issue(s) found. Fix these cells in Excel, upload again, and validate.</p><div className="mt-3 max-h-80 overflow-auto rounded-xl border border-rose-200 bg-white"><table className="w-full min-w-[620px] text-left text-sm"><thead className="sticky top-0 bg-rose-100 text-rose-900"><tr><th className="px-3 py-2">Excel row</th><th className="px-3 py-2">Field</th><th className="px-3 py-2">Issue</th></tr></thead><tbody>{validation.errors.map((error, index) => <tr className="border-t border-zinc-100" key={`${error.rowNumber}-${error.field}-${index}`}><td className="px-3 py-2 font-medium text-zinc-800">{error.rowNumber ?? "Workbook"}</td><td className="px-3 py-2 text-zinc-700">{error.field}</td><td className="px-3 py-2 text-zinc-700">{error.message}</td></tr>)}</tbody></table></div></>}</div> : null}
    </CardContent>
  </Card>;
}
