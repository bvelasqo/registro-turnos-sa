import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { FIXED_ROWS } from "@/lib/fixedRows";
import { getSheetRange, getSheetsClient, getSpreadsheetId } from "@/lib/sheets";

type Item = {
  proceso: string;
  equipo: string;
  producto: string;
  lote: string;
  estado: string;
  observacion: string;
};

const REQUIERE_OBS = new Set(["Detenido", "Falla"]);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items: Item[] = Array.isArray(body.items) ? body.items : [];

    const map = new Map(items.map((i) => [`${i.proceso}||${i.equipo}`, i]));

    for (const r of FIXED_ROWS) {
      const key = `${r.proceso}||${r.equipo}`;
      if (!map.has(key)) {
        return NextResponse.json(
          { error: `Faltan datos para: ${r.equipo}` },
          { status: 400 }
        );
      }
      const it = map.get(key)!;
      if (!(it.producto ?? "").trim()) {
        return NextResponse.json(
          { error: `Producto obligatorio en: ${r.equipo}` },
          { status: 400 }
        );
      }
      if (!(it.lote ?? "").trim()) {
        return NextResponse.json(
          { error: `Lote obligatorio en: ${r.equipo}` },
          { status: 400 }
        );
      }
      if (REQUIERE_OBS.has(it.estado) && !(it.observacion ?? "").trim()) {
        return NextResponse.json(
          { error: `Observación obligatoria para "${it.estado}" en: ${r.equipo}` },
          { status: 400 }
        );
      }
    }

    const fechaRegistro = DateTime.now()
      .setZone("America/Bogota")
      .toFormat("dd/LL/yyyy HH:mm:ss");

    const sheets = getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const values = FIXED_ROWS.map((r) => {
      const it = map.get(`${r.proceso}||${r.equipo}`)!;
      return [
        fechaRegistro,
        r.proceso,
        r.equipo,
        it.producto ?? "",
        (it.lote ?? "").trim(),
        it.estado ?? "",
        it.observacion ?? "",
      ];
    });

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: getSheetRange("A2:G"),
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: getSheetRange("A2:G"),
      valueInputOption: "RAW",
      requestBody: { values },
    });

    return NextResponse.json({ ok: true, fechaRegistro });
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
