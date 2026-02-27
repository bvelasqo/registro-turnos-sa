import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { getSheetRange, getSheetsClient, getSpreadsheetId } from "@/lib/sheets";

function normalizeFecha(fecha: string): string {
  const raw = (fecha ?? "").trim();
  if (!raw) return raw;

  if (/^\d+(?:[.,]\d+)?$/.test(raw)) {
    const serial = Number(raw.replace(",", "."));
    if (!Number.isNaN(serial)) {
      const millis = Date.UTC(1899, 11, 30) + serial * 24 * 60 * 60 * 1000;
      return DateTime.fromMillis(millis, { zone: "utc" })
        .setZone("America/Bogota")
        .toFormat("dd/LL/yyyy HH:mm:ss");
    }
  }

  return raw;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 10), 50);

    const sheets = getSheetsClient();
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: getSheetRange("A:G"),
    });

    const rows = resp.data.values ?? [];
    if (rows.length <= 1) return NextResponse.json({ registros: [] });

    const byFecha = new Map<
      string,
      {
        fechaRegistro: string;
        productos: Set<string>;
        lotes: Set<string>;
        count: number;
      }
    >();

    for (const r of rows.slice(1)) {
      const fecha = normalizeFecha(r[0] ?? "");
      if (!fecha) continue;
      if (!byFecha.has(fecha)) {
        byFecha.set(fecha, {
          fechaRegistro: fecha,
          productos: new Set<string>(),
          lotes: new Set<string>(),
          count: 0,
        });
      }
      const current = byFecha.get(fecha)!;
      if (r[3]) current.productos.add(r[3]);
      if (r[4]) current.lotes.add(r[4]);
      current.count += 1;
    }

    const registros = Array.from(byFecha.values())
      .map((item) => ({
        fechaRegistro: item.fechaRegistro,
        producto:
          item.productos.size > 1
            ? "Múltiples productos"
            : (Array.from(item.productos)[0] ?? ""),
        lote:
          item.lotes.size > 1
            ? "Múltiples lotes"
            : (Array.from(item.lotes)[0] ?? ""),
        count: item.count,
      }))
      .sort((a, b) => (a.fechaRegistro < b.fechaRegistro ? 1 : -1))
      .slice(0, limit);

    return NextResponse.json({ registros });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error inesperado";
    if (msg.includes("Unable to parse range")) {
      return NextResponse.json(
        {
          error:
            "No se encontró la pestaña del Sheet. Verifica que exista y se llame exactamente 'Histórico' (o configura GSHEET_TAB).",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
