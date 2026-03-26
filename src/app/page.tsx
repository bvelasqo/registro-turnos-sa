"use client";

import { useEffect, useMemo, useState } from "react";
import { FIXED_ROWS } from "@/lib/fixedRows";
import { ESTADOS, PRODUCTOS,TURNOS } from "@/lib/options";

type RowState = { producto: string; lote: string; estado: string; observacion: string };
type Recent = {
  fechaRegistro: string;
  producto: string;
  lote: string;
  count: number;
};

type CurrentItem = {
  proceso: string;
  equipo: string;
  producto: string;
  lote: string;
  estado: string;
  observacion: string;
};

const REQUIERE_OBS = new Set(["Detenido", "Falla"]);

export default function Page() {
  const initialTable = useMemo(() => {
    const obj: Record<string, RowState> = {};
    FIXED_ROWS.forEach((r) => {
      obj[`${r.proceso}||${r.equipo}`] = {
        producto: PRODUCTOS[0],
        lote: "",
        estado: ESTADOS[0],
        observacion: "",
      };
    });
    return obj;
  }, []);

  const [table, setTable] = useState<Record<string, RowState>>(initialTable);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);

  async function loadRecent() {
    const res = await fetch("/api/registros?limit=10");
    const json = await res.json();
    setRecent(json.registros ?? []);

    const incoming: CurrentItem[] = Array.isArray(json.registroActual?.items)
      ? json.registroActual.items
      : [];

    if (incoming.length > 0) {
      setTable((prev) => {
        const next = { ...prev };
        for (const item of incoming) {
          const key = `${item.proceso}||${item.equipo}`;
          if (!next[key]) continue;
          next[key] = {
            producto: item.producto || next[key].producto,
            lote: item.lote || "",
            estado: item.estado || next[key].estado,
            observacion: item.observacion || "",
          };
        }
        return next;
      });
    }
  }

  useEffect(() => {
    void loadRecent();
  }, []);

  function setRowField(key: string, field: keyof RowState, value: string) {
    setTable((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  async function save() {
    setMsg(null);

    for (const r of FIXED_ROWS) {
      const key = `${r.proceso}||${r.equipo}`;
      const st = table[key];
      if (!st.producto.trim()) {
        return setMsg({ text: `Producto obligatorio en: ${r.equipo}`, ok: false });
      }
      if (!st.lote.trim()) {
        return setMsg({ text: `Lote obligatorio en: ${r.equipo}`, ok: false });
      }
      if (REQUIERE_OBS.has(st.estado) && !st.observacion.trim()) {
        return setMsg({
          text: `Observación obligatoria para "${st.estado}" en: ${r.equipo}`,
          ok: false,
        });
      }
    }

    const items = FIXED_ROWS.map((r) => {
      const key = `${r.proceso}||${r.equipo}`;
      return {
        proceso: r.proceso,
        equipo: r.equipo,
        ...table[key],
        lote: table[key].lote.trim(),
      };
    });

    setSaving(true);
    try {
      const res = await fetch("/api/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (!res.ok) return setMsg({ text: json.error ?? "Error al guardar.", ok: false });

      setMsg({ text: `✅ Registro guardado: ${json.fechaRegistro}`, ok: true });
      await loadRecent();
    } finally {
      setSaving(false);
    }
  }

  const grouped = FIXED_ROWS.reduce<{ proceso: string; equipos: string[] }[]>(
    (acc, r) => {
      const last = acc[acc.length - 1];
      if (last && last.proceso === r.proceso) last.equipos.push(r.equipo);
      else acc.push({ proceso: r.proceso, equipos: [r.equipo] });
      return acc;
    },
    []
  );

  return (
    <main className="mx-auto flex w-full max-w-[1850px] flex-col gap-4 px-2 py-3 sm:gap-5 sm:px-3 sm:py-4 md:gap-6 md:px-5 md:py-6 lg:px-6">
      <header className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4 md:p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">Registro de Entrega de Turno</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Selecciona producto y lote por cada equipo, valida observaciones obligatorias y guarda el corte del turno.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4 md:p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex justify-end">
          <button
            onClick={() => void save()}
            disabled={saving}
            className="h-10 rounded-lg bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {saving ? "Guardando..." : "Guardar registro"}
          </button>
        </div>
      </section>

      {msg && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            msg.ok
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-800 dark:border-zinc-800 dark:text-zinc-100">
          Estado de equipos ({FIXED_ROWS.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-xs sm:text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-950/40">
              <tr>
                {[
                  { label: "Proceso", cls: "w-[14%]" },
                  { label: "Equipo", cls: "w-[24%]" },
                  { label: "Producto", cls: "w-[24%]" },
                  { label: "Lote", cls: "w-[12%]" },
                  { label: "Estado", cls: "w-[14%]" },
                  { label: "Observación", cls: "w-[12%]" },
                ].map((h) => (
                  <th
                    key={h.label}
                    className={`border-b border-zinc-200 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 sm:px-3 sm:py-3 dark:border-zinc-800 dark:text-zinc-400 ${h.cls}`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.flatMap(({ proceso, equipos }) =>
                equipos.map((equipo, idx) => {
                  const key = `${proceso}||${equipo}`;
                  const st = table[key];
                  const needsObs = REQUIERE_OBS.has(st.estado);
                  const missingObs = needsObs && !st.observacion.trim();

                  return (
                    <tr key={key} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                      {idx === 0 && (
                        <td
                          rowSpan={equipos.length}
                            className="border-r border-zinc-200 bg-zinc-50 px-2 py-2 align-middle font-semibold text-zinc-800 sm:px-3 sm:py-3 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-100"
                        >
                          {proceso}
                        </td>
                      )}
                      <td className="px-2 py-2 text-zinc-700 sm:px-3 sm:py-3 dark:text-zinc-300">{equipo}</td>
                      <td className="px-2 py-2 sm:px-3">
                        <select
                          value={st.producto}
                          onChange={(e) => setRowField(key, "producto", e.target.value)}
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:ring-zinc-800"
                        >
                          {PRODUCTOS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2 sm:px-3">
                        <input
                          value={st.lote}
                          onChange={(e) => setRowField(key, "lote", e.target.value)}
                          placeholder="Lote..."
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:ring-zinc-800"
                        />
                      </td>
                      <td className="px-2 py-2 sm:px-3">
                        <select
                          value={st.estado}
                          onChange={(e) => setRowField(key, "estado", e.target.value)}
                          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition dark:bg-zinc-950 ${
                            needsObs
                              ? "border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 dark:border-rose-800 dark:focus:ring-rose-900"
                              : "border-zinc-300 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:focus:ring-zinc-800"
                          }`}
                        >
                          {ESTADOS.map((x) => (
                            <option key={x} value={x}>
                              {x}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2 sm:px-3">
                        <input
                          value={st.observacion}
                          onChange={(e) => setRowField(key, "observacion", e.target.value)}
                          placeholder={needsObs ? "Obligatorio para este estado" : "Observación..."}
                          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition dark:bg-zinc-950 ${
                            missingObs
                              ? "border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 dark:border-rose-800 dark:focus:ring-rose-900"
                              : "border-zinc-300 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:focus:ring-zinc-800"
                          }`}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm sm:p-4 md:p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold tracking-tight">Registros recientes</h2>
          <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            Últimos {recent.length}
          </span>
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No hay registros aún.</p>
        ) : (
          <div className="grid gap-2">
            {recent.map((r) => (
              <article
                key={r.fechaRegistro}
                className="rounded-xl border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800"
              >
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">{r.fechaRegistro}</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-300">{r.producto}</p>
                <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                  Lote: <span className="font-semibold text-zinc-700 dark:text-zinc-200">{r.lote}</span>
                  <span className="mx-2">•</span>
                  Equipos: {r.count}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
