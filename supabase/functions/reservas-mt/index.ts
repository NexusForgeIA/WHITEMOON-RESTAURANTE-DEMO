import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const ESTADOS = ["pendiente","confirmada","sentada","completada","no_show","cancelada"];
const ESTADOS_OCUPAN = ["pendiente","confirmada","sentada","completada"];
const TURNOS = ["comida","cena"];
const ORIGENES = ["chatbot","manual","web"];
const PANEL_ACTIONS = ["panel_listar","panel_estado","panel_alta","panel_mesas","panel_mesa_guardar","panel_mesa_borrar","panel_config_guardar"];

function hoyISO() { return new Date().toISOString().slice(0, 10); }
function envSuffix(s: string) { return s.toUpperCase().replace(/[^A-Z0-9]/g, "_"); }

async function getConfig(tenant: string) {
  const { data } = await supabase.from("reservas_config").select("*").eq("tenant", tenant).maybeSingle();
  return data;
}

function aforoDeTurno(config: any, turno: string): number {
  const t = (config?.turnos || []).find((x: any) => x.nombre === turno);
  return t ? (Number(t.aforo_comensales) || 0) : 0;
}

async function comensalesOcupados(tenant: string, fecha: string, turno: string): Promise<number> {
  const { data } = await supabase.from("reservas")
    .select("personas,estado").eq("tenant", tenant).eq("fecha", fecha).eq("turno", turno);
  return (data || []).filter((r: any) => ESTADOS_OCUPAN.includes(r.estado))
    .reduce((s: number, r: any) => s + (Number(r.personas) || 0), 0);
}

// Aforo propio de una zona. Acepta config.zonas en texto (["Interior"]) o en objetos
// ([{nombre:"Interior",aforo:24}]). Texto, sin aforo o aforo<=0 = 0 = sin limite propio:
// la zona se rige solo por el aforo del turno.
function aforoDeZona(config: any, zona: string): number {
  const z = (config?.zonas || []).find((x: any) => x && typeof x === "object" && x.nombre === zona);
  const n = z ? Number(z.aforo) || 0 : 0;
  return n > 0 ? n : 0;
}

async function comensalesOcupadosZona(tenant: string, fecha: string, turno: string, zona: string): Promise<number> {
  const { data } = await supabase.from("reservas")
    .select("personas,estado").eq("tenant", tenant).eq("fecha", fecha).eq("turno", turno).eq("zona_preferida", zona);
  return (data || []).filter((r: any) => ESTADOS_OCUPAN.includes(r.estado))
    .reduce((s: number, r: any) => s + (Number(r.personas) || 0), 0);
}

// Clave de grupo (marca): demo si el grupo acaba en -demo, si no via Secret RESERVAS_PANEL_KEY_GRUPO_<GRUPO>
function grupoKeyOK(grupo: string, key: string): boolean {
  if (!grupo || !key) return false;
  if (grupo.endsWith("-demo")) return key === "demo";
  const grpKey = Deno.env.get("RESERVAS_PANEL_KEY_GRUPO_" + envSuffix(grupo));
  return !!grpKey && key === grpKey;
}

async function notificarTelegram(config: any, r: any) {
  try {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chat = config?.telegram_chat_id;
    if (!token || !chat) return;
    const nombreRest = config?.restaurante_nombre || "Restaurante";
    const ciudad = config?.ciudad ? ` (${config.ciudad})` : "";
    const zona = r.zona_preferida ? `\nZona: ${r.zona_preferida}` : "";
    const txt = `🍽️ Nueva reserva — ${nombreRest}${ciudad}\n${r.cliente_nombre} · ${r.personas} pax\n${r.fecha} · ${r.turno}${r.hora ? " " + r.hora : ""}${zona}\nTel: ${r.cliente_telefono}\nEstado: ${r.estado}`;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: txt }),
    });
  } catch (_) { /* fire-and-forget */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const action = body.action;
  const tenant = String(body.token || body.tenant || "").trim();

  // Autorizacion de panel por sede: acepta la clave propia de la sede O la clave de su marca (grupo)
  async function panelAuthorized(): Promise<boolean> {
    const key = String(body.panel_key || "");
    if (!key || !tenant) return false;
    if (tenant.startsWith("demo-")) return key === "demo";
    const ownKey = Deno.env.get("RESERVAS_PANEL_KEY_" + envSuffix(tenant));
    if (ownKey && key === ownKey) return true;
    const config = await getConfig(tenant);
    const grupo = String(config?.grupo || "");
    return grupo ? grupoKeyOK(grupo, key) : false;
  }

  try {
    // --- Nivel marca PUBLICO (no requiere tenant ni clave): sedes de un grupo para el reservador web ---
    if (action === "sedes_publicas") {
      const grupo = String(body.grupo || "").trim();
      if (!grupo) return json({ error: "grupo_required" }, 400);
      const { data } = await supabase.from("reservas_config")
        .select("tenant,ciudad,restaurante_nombre,zonas,turnos").eq("grupo", grupo).order("ciudad", { ascending: true });
      const sedes = (data || []).map((s: any) => ({
        tenant: s.tenant, ciudad: s.ciudad, restaurante_nombre: s.restaurante_nombre,
        zonas: s.zonas || [],
        turnos: (s.turnos || []).map((t: any) => ({ nombre: t.nombre, hora_ini: t.hora_ini, hora_fin: t.hora_fin })),
      }));
      return json({ ok: true, grupo, sedes });
    }

    // --- Nivel marca (no requiere tenant, requiere clave): lista las sedes de un grupo para el panel ---
    if (action === "panel_sedes") {
      const grupo = String(body.grupo || "").trim();
      const key = String(body.panel_key || "");
      if (!grupo) return json({ error: "grupo_required" }, 400);
      if (!grupoKeyOK(grupo, key)) return json({ error: "no_autorizado" }, 401);
      const { data } = await supabase.from("reservas_config")
        .select("tenant,ciudad,restaurante_nombre").eq("grupo", grupo).order("ciudad", { ascending: true });
      return json({ ok: true, grupo, sedes: data || [] });
    }

    if (!tenant) return json({ error: "token_required" }, 400);

    if (action === "disponibilidad") {
      const { fecha, turno } = body;
      if (!fecha || !turno) return json({ error: "faltan_datos" }, 400);
      const config = await getConfig(tenant);
      const aforo = aforoDeTurno(config, turno);
      const ocup = await comensalesOcupados(tenant, fecha, turno);
      const disponibles = aforo > 0 ? Math.max(0, aforo - ocup) : null;
      const zona = body.zona ? String(body.zona) : "";
      const aforoZona = zona ? aforoDeZona(config, zona) : 0;
      if (aforoZona > 0) {
        const ocupZona = await comensalesOcupadosZona(tenant, fecha, turno, zona);
        return json({
          ok: true, aforo, ocupados: ocup, disponibles,
          zona, aforo_zona: aforoZona, ocupados_zona: ocupZona, disponibles_zona: Math.max(0, aforoZona - ocupZona),
        });
      }
      return json({ ok: true, aforo, ocupados: ocup, disponibles });
    }

    if (action === "crear_reserva") {
      const { fecha, turno, hora, personas, nombre, telefono, email, notas, origen, zona_preferida } = body;
      if (!fecha || !turno || !personas || !nombre || !telefono) return json({ error: "faltan_datos" }, 400);
      if (String(fecha) < hoyISO()) return json({ error: "fecha_pasada" }, 400);
      if (!TURNOS.includes(turno)) return json({ error: "turno_invalido" }, 400);
      const p = Number(personas);
      if (!(p >= 1)) return json({ error: "personas_invalido" }, 400);
      const config = await getConfig(tenant);
      const aforo = aforoDeTurno(config, turno);
      if (aforo > 0) {
        const ocup = await comensalesOcupados(tenant, fecha, turno);
        if (ocup + p > aforo) return json({ ok: false, motivo: "sin_aforo", disponibles: Math.max(0, aforo - ocup) });
      }
      const zona = zona_preferida ? String(zona_preferida) : "";
      const aforoZona = zona ? aforoDeZona(config, zona) : 0;
      if (aforoZona > 0) {
        const ocupZona = await comensalesOcupadosZona(tenant, fecha, turno, zona);
        if (ocupZona + p > aforoZona) {
          return json({ ok: false, motivo: "sin_aforo_zona", zona, disponibles_zona: Math.max(0, aforoZona - ocupZona) });
        }
      }
      const estado = config?.auto_confirmar ? "confirmada" : "pendiente";
      const { data, error } = await supabase.from("reservas").insert({
        tenant, fecha, turno, hora: hora || null, personas: p,
        cliente_nombre: String(nombre), cliente_telefono: String(telefono),
        cliente_telefono_norm: String(telefono).replace(/\D/g, ""),
        cliente_email: email || null, notas: notas || null,
        zona_preferida: zona_preferida ? String(zona_preferida) : "",
        estado, origen: ORIGENES.includes(origen) ? origen : "chatbot",
      }).select("id,estado").single();
      if (error) return json({ error: "insert_error", detalle: error.message }, 500);
      await supabase.from("reservas_log").insert({ tenant, reserva_id: data.id, accion: "crear", detalle: `${nombre} ${p}p ${fecha} ${turno}` });
      await notificarTelegram(config, { cliente_nombre: nombre, personas: p, fecha, turno, hora, cliente_telefono: telefono, estado: data.estado, zona_preferida });
      return json({ ok: true, id: data.id, estado: data.estado });
    }

    if (PANEL_ACTIONS.includes(action)) {
      if (!(await panelAuthorized())) return json({ error: "no_autorizado" }, 401);

      if (action === "panel_listar") {
        const fecha = body.fecha || hoyISO();
        const [rRes, rMes, config] = await Promise.all([
          supabase.from("reservas").select("*").eq("tenant", tenant).eq("fecha", fecha).order("hora", { ascending: true }),
          supabase.from("reservas_mesas").select("*").eq("tenant", tenant).order("orden", { ascending: true }),
          getConfig(tenant),
        ]);
        return json({ ok: true, fecha, reservas: rRes.data || [], mesas: rMes.data || [], config });
      }

      if (action === "panel_estado") {
        const { id, estado } = body;
        if (!id || !ESTADOS.includes(estado)) return json({ error: "datos_invalidos" }, 400);
        const { error } = await supabase.from("reservas").update({ estado }).eq("tenant", tenant).eq("id", id);
        if (error) return json({ error: "update_error", detalle: error.message }, 500);
        await supabase.from("reservas_log").insert({ tenant, reserva_id: id, accion: "estado", detalle: estado });
        return json({ ok: true });
      }

      if (action === "panel_alta") {
        const { fecha, turno, hora, personas, nombre, telefono, email, notas, mesa_id, zona_preferida } = body;
        if (!fecha || !turno || !personas || !nombre) return json({ error: "faltan_datos" }, 400);
        if (!TURNOS.includes(turno)) return json({ error: "turno_invalido" }, 400);
        const p = Number(personas);
        if (!(p >= 1)) return json({ error: "personas_invalido" }, 400);
        const { data, error } = await supabase.from("reservas").insert({
          tenant, fecha, turno, hora: hora || null, personas: p,
          cliente_nombre: String(nombre), cliente_telefono: telefono ? String(telefono) : "-",
          cliente_telefono_norm: telefono ? String(telefono).replace(/\D/g, "") : null,
          cliente_email: email || null, notas: notas || null, mesa_id: mesa_id || null,
          zona_preferida: zona_preferida ? String(zona_preferida) : "",
          estado: "confirmada", origen: "manual",
        }).select("id").single();
        if (error) return json({ error: "insert_error", detalle: error.message }, 500);
        await supabase.from("reservas_log").insert({ tenant, reserva_id: data.id, accion: "alta_manual", detalle: `${nombre} ${p}p` });
        return json({ ok: true, id: data.id });
      }

      if (action === "panel_mesas") {
        const { data } = await supabase.from("reservas_mesas").select("*").eq("tenant", tenant).order("orden", { ascending: true });
        return json({ ok: true, mesas: data || [] });
      }

      if (action === "panel_mesa_guardar") {
        const { id, nombre, zona, capacidad, activa, orden } = body;
        if (!nombre) return json({ error: "faltan_datos" }, 400);
        const row: any = {
          tenant, nombre: String(nombre), zona: zona || "Interior",
          capacidad: Math.max(1, Number(capacidad) || 2),
          activa: activa !== false, orden: Number(orden) || 0,
          updated_at: new Date().toISOString(),
        };
        if (id) {
          const { error } = await supabase.from("reservas_mesas").update(row).eq("tenant", tenant).eq("id", id);
          if (error) return json({ error: "update_error", detalle: error.message }, 500);
          return json({ ok: true, id });
        }
        const { data, error } = await supabase.from("reservas_mesas").insert(row).select("id").single();
        if (error) return json({ error: "insert_error", detalle: error.message }, 500);
        return json({ ok: true, id: data.id });
      }

      if (action === "panel_mesa_borrar") {
        const { id } = body;
        if (!id) return json({ error: "faltan_datos" }, 400);
        const { error } = await supabase.from("reservas_mesas").delete().eq("tenant", tenant).eq("id", id);
        if (error) return json({ error: "delete_error", detalle: error.message }, 500);
        return json({ ok: true });
      }

      if (action === "panel_config_guardar") {
        const c = body.config || {};
        const upd: any = { updated_at: new Date().toISOString() };
        for (const k of ["restaurante_nombre","gerente_nombre","wa_number","email_from","email_nombre","telegram_chat_id","ciudad"]) {
          if (k in c) upd[k] = String(c[k] ?? "");
        }
        if ("auto_confirmar" in c) upd.auto_confirmar = !!c.auto_confirmar;
        if ("turnos" in c) upd.turnos = c.turnos;
        if ("zonas" in c) upd.zonas = c.zonas;
        const { error } = await supabase.from("reservas_config").update(upd).eq("tenant", tenant);
        if (error) return json({ error: "update_error", detalle: error.message }, 500);
        return json({ ok: true });
      }
    }

    return json({ error: "accion_desconocida" }, 400);
  } catch (e) {
    return json({ error: "server_error", detalle: String(e) }, 500);
  }
});
