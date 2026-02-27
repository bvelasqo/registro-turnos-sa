import { google } from "googleapis";

export function getSheetsClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT_JSON");

  const credentials = JSON.parse(raw);
  if (typeof credentials.private_key === "string") {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export function getSpreadsheetId(): string {
  const id = process.env.GSHEET_ID;
  if (!id) throw new Error("Falta GSHEET_ID");
  return id;
}

export function getSheetTabName(): string {
  const tab = (process.env.GSHEET_TAB ?? "Histórico").trim();
  if (!tab) throw new Error("Falta GSHEET_TAB");
  return tab;
}

export function getSheetRange(cells: string = "A:G"): string {
  const tab = getSheetTabName().replace(/'/g, "''");
  return `'${tab}'!${cells}`;
}
