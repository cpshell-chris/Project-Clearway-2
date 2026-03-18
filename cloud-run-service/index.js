import express from "express";
import { getDefaultCultureProfile } from "./prompts/cultureProfiles.js";
import {
  buildRoCopilotSummaryPrompt,
  buildRoCopilotSummarySystemPrompt,
  buildRoCopilotQuestionPrompt,
  buildRoCopilotQuestionSystemPrompt,
  buildInterpretDviPrompts,
  buildPartLookupPrompts,
  buildObjectionHelpPrompts,
  buildExhaustAssistPrompts
} from "./prompts/roCopilot.js";
import { buildAISystemPrompt } from "./prompts/aiChat.js";

const app = express();
app.use(express.json());

/* ============================
   CORS
============================ */

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes("*")) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

/* ============================
   Config Helpers
============================ */

function getTekmetricConfig() {
  return {
    TEKMETRIC_CLIENT_ID: process.env.TEKMETRIC_CLIENT_ID,
    TEKMETRIC_CLIENT_SECRET: process.env.TEKMETRIC_CLIENT_SECRET,
    TEKMETRIC_BASE_URL: process.env.TEKMETRIC_BASE_URL
  };
}

function validateTekmetricConfig() {
  const {
    TEKMETRIC_CLIENT_ID,
    TEKMETRIC_CLIENT_SECRET,
    TEKMETRIC_BASE_URL
  } = getTekmetricConfig();

  const missing = [];
  if (!TEKMETRIC_CLIENT_ID) missing.push("TEKMETRIC_CLIENT_ID");
  if (!TEKMETRIC_CLIENT_SECRET) missing.push("TEKMETRIC_CLIENT_SECRET");
  if (!TEKMETRIC_BASE_URL) missing.push("TEKMETRIC_BASE_URL");

  return {
    ok: missing.length === 0,
    missing
  };
}

function getFetch() {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("Fetch API not available. Use Node 18+.");
  }
  return globalThis.fetch;
}

/* ============================
   OAuth Token Handling
============================ */

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const config = validateTekmetricConfig();
  if (!config.ok) {
    throw new Error(
      `Tekmetric environment variables not configured: ${config.missing.join(", ")}`
    );
  }

  const {
    TEKMETRIC_CLIENT_ID,
    TEKMETRIC_CLIENT_SECRET,
    TEKMETRIC_BASE_URL
  } = getTekmetricConfig();

  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const auth = Buffer.from(
    `${TEKMETRIC_CLIENT_ID}:${TEKMETRIC_CLIENT_SECRET}`
  ).toString("base64");

  const fetch = getFetch();
  const response = await fetch(`${TEKMETRIC_BASE_URL}/api/v1/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tekmetric auth failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;

  const expiresInMs = Number.isFinite(Number(data.expires_in))
    ? Number(data.expires_in) * 1000
    : 55 * 60 * 1000;

  tokenExpiresAt = now + Math.max(60 * 1000, expiresInMs - 60 * 1000);
  return cachedToken;
}

/* ============================
   Tekmetric Request Helpers
============================ */

async function tekmetricRequest(token, method, path, body) {
  const { TEKMETRIC_BASE_URL } = getTekmetricConfig();
  const fetch = getFetch();

  const response = await fetch(`${TEKMETRIC_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tekmetric ${method} failed (${response.status}) [${path}]: ${text}`);
  }

  return response.json();
}

function tekmetricGet(token, path) {
  return tekmetricRequest(token, "GET", path);
}

function formatCustomerName(customer) {
  if (!customer || typeof customer !== "object") return "";

  const first = typeof customer.firstName === "string" ? customer.firstName.trim() : "";
  const last = typeof customer.lastName === "string" ? customer.lastName.trim() : "";
  const full = [first, last].filter(Boolean).join(" ").trim();

  if (full) return full;
  if (typeof customer.name === "string") return customer.name.trim();
  if (typeof customer.displayName === "string") return customer.displayName.trim();
  return "";
}

function formatVehicleLabel(vehicle) {
  if (!vehicle || typeof vehicle !== "object") return "";

  const year = vehicle.year != null ? String(vehicle.year).trim() : "";
  const make = typeof vehicle.make === "string" ? vehicle.make.trim() : "";
  const model = typeof vehicle.model === "string" ? vehicle.model.trim() : "";
  const subModel = typeof vehicle.subModel === "string" ? vehicle.subModel.trim() : "";
  const label = [year, make, model, subModel].filter(Boolean).join(" ").trim();

  if (label) return label;
  if (typeof vehicle.name === "string") return vehicle.name.trim();
  return "";
}

function toList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

const roCopilotContextCache = new Map();
const RO_COPILOT_CACHE_TTL_MS = 45 * 1000;

function getCachedRoCopilotContext(roId) {
  const key = String(roId);
  const cached = roCopilotContextCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    roCopilotContextCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedRoCopilotContext(roId, value) {
  roCopilotContextCache.set(String(roId), {
    value,
    expiresAt: Date.now() + RO_COPILOT_CACHE_TTL_MS
  });
}

async function safeTekmetricGet(token, path) {
  try {
    return await tekmetricGet(token, path);
  } catch (error) {
    console.warn(`safeTekmetricGet failed [${path}]:`, error.message);
    return null;
  }
}

/* ============================
   Job / RO Helpers
============================ */

async function fetchRoJobs(token, roId, shopId) {
  const pageSize = 200;
  const jobs = [];
  let page = 0;

  try {
    while (true) {
      const params = new URLSearchParams({
        shop: String(shopId),
        repairOrderId: String(roId),
        page: String(page),
        size: String(pageSize)
      });

      const payload = await tekmetricGet(
        token,
        `/api/v1/jobs?${params.toString()}`
      );

      const pageJobs = Array.isArray(payload?.content)
        ? payload.content
        : [];

      if (pageJobs.length === 0) break;

      jobs.push(...pageJobs);

      if (payload?.last === true) break;
      if (pageJobs.length < pageSize) break;

      page += 1;
    }

    return jobs;
  } catch (err) {
    console.warn("fetchRoJobs failed:", err.message);
    return jobs;
  }
}

async function fetchVehicleRepairOrders(token, vehicleId, shopId) {
  const pageSize = 200;
  const ros = [];
  let page = 0;

  try {
    while (true) {
      const params = new URLSearchParams({
        shop: String(shopId),
        vehicleId: String(vehicleId),
        page: String(page),
        size: String(pageSize)
      });

      const payload = await tekmetricGet(
        token,
        `/api/v1/repair-orders?${params.toString()}`
      );

      const pageRos = Array.isArray(payload?.content)
        ? payload.content
        : [];

      if (pageRos.length === 0) break;

      ros.push(...pageRos);

      if (payload?.last === true) break;
      if (pageRos.length < pageSize) break;

      page += 1;
    }

    return ros;
  } catch (err) {
    console.warn("fetchVehicleRepairOrders failed:", err.message);
    return ros;
  }
}

/* ============================
   Appointment Count Helpers
============================ */

function toDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getAppointmentsFromResponse(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function buildDateRangeKeys(startDate, endDate) {
  const keys = [];
  const cursor = new Date(startDate);
  const end = new Date(endDate);

  cursor.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys.filter(Boolean);
}

function getRangeBounds(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

async function fetchAppointmentsForRange(token, shopId, startDate, endDate) {
  const { startIso, endIso } = getRangeBounds(startDate, endDate);

  const pageSize = 200;
  const collected = [];
  let page = 0;

  try {
    while (true) {
      const params = new URLSearchParams({
        shop: String(shopId),
        start: startIso,
        end: endIso,
        page: String(page),
        size: String(pageSize)
      });

      const payload = await tekmetricGet(
        token,
        `/api/v1/appointments?${params.toString()}`
      );

      const list = getAppointmentsFromResponse(payload);
      if (list.length === 0) break;

      collected.push(...list);

      const isLastPage = payload?.last === true;
      const totalPages = Number(payload?.totalPages);

      if (isLastPage) break;
      if (Number.isFinite(totalPages) && page + 1 >= totalPages) break;
      if (list.length < pageSize) break;

      page += 1;
    }

    return collected;
  } catch (err) {
    console.warn("fetchAppointmentsForRange failed:", err.message);
    return collected;
  }
}

/* ============================
   Routes
============================ */

app.get("/", (req, res) => {
  res.status(200).send("Advance Appointment Service Running");
});

app.get("/healthz", (req, res) => {
  const config = validateTekmetricConfig();
  res.status(200).json({
    ok: true,
    service: "advance-appointment-service",
    tekmetricConfigured: config.ok,
    missingEnvVars: config.missing
  });
});

// ============================
// RO Search
// ============================
app.get("/ro-search", async (req, res) => {
  try {
    const config = validateTekmetricConfig();
    if (!config.ok) {
      return res.status(503).json({
        success: false,
        message: "Service not fully configured",
        missingEnvVars: config.missing
      });
    }

    const { shopId, q, page = "0", size = "20" } = req.query;

    if (!shopId) {
      return res.status(400).json({ success: false, message: "shopId is required" });
    }

    const token = await getAccessToken();

    const params = new URLSearchParams({
      shop: String(shopId),
      page: String(page),
      size: String(Math.min(Number(size) || 20, 100))
    });

    if (q && String(q).trim()) params.set("search", String(q).trim());

    params.append("repairOrderStatusId", "1");
    params.append("repairOrderStatusId", "2");
    params.append("repairOrderStatusId", "3");

    params.set("sort", "createdDate");
    params.set("sortDirection", "DESC");

    const payload = await tekmetricGet(token, `/api/v1/repair-orders?${params.toString()}`);

    const rows = Array.isArray(payload?.content) ? payload.content : [];

    const customerIds = [...new Set(
      rows.map((ro) => ro?.customerId).filter((id) => id != null).map((id) => String(id))
    )];

    const vehicleIds = [...new Set(
      rows.map((ro) => ro?.vehicleId).filter((id) => id != null).map((id) => String(id))
    )];

    const customerMap = new Map();
    const vehicleMap = new Map();

    await Promise.all([
      Promise.all(customerIds.map(async (customerId) => {
        try {
          const customer = await tekmetricGet(token, `/api/v1/customers/${encodeURIComponent(customerId)}`);
          customerMap.set(customerId, customer);
        } catch (err) {
          console.warn(`/ro-search customer lookup failed (${customerId}):`, err.message);
        }
      })),
      Promise.all(vehicleIds.map(async (vehicleId) => {
        try {
          const vehicle = await tekmetricGet(token, `/api/v1/vehicles/${encodeURIComponent(vehicleId)}`);
          vehicleMap.set(vehicleId, vehicle);
        } catch (err) {
          console.warn(`/ro-search vehicle lookup failed (${vehicleId}):`, err.message);
        }
      }))
    ]);

    const items = rows.map((ro) => {
      const customer = customerMap.get(String(ro.customerId));
      const vehicleData = vehicleMap.get(String(ro.vehicleId));
      const customerName =
        formatCustomerName(customer) ||
        (typeof ro.customerName === "string" ? ro.customerName.trim() : "") ||
        (typeof ro.customer === "string" ? ro.customer.trim() : "");

      const vehicle =
        formatVehicleLabel(vehicleData) ||
        (typeof ro.vehicle === "string" ? ro.vehicle.trim() : "") ||
        (typeof ro.vehicleLabel === "string" ? ro.vehicleLabel.trim() : "");

      return {
        id: ro.id,
        roNumber: ro.repairOrderNumber,
        statusId: ro.repairOrderStatus?.id ?? null,
        statusName: ro.repairOrderStatus?.name ?? "",
        status: ro.repairOrderStatus?.name ?? "",
        customerName,
        vehicle,
        customerId: ro.customerId ?? null,
        vehicleId: ro.vehicleId ?? null,
        milesIn: ro.milesIn ?? null,
        milesOut: ro.milesOut ?? null,
        createdDate: ro.createdDate ?? null,
        updatedDate: ro.updatedDate ?? null
      };
    });

    return res.json({
      success: true,
      items,
      page: payload?.number ?? (Number(page) || 0),
      totalPages: payload?.totalPages ?? 0,
      totalElements: payload?.totalElements ?? items.length,
      last: payload?.last ?? true
    });
  } catch (err) {
    console.error("/ro-search error", err);
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Internal server error"
    });
  }
});

app.get("/ro/:roId", async (req, res) => {
  try {
    const config = validateTekmetricConfig();
    if (!config.ok) {
      return res.status(503).json({
        success: false,
        message: "Service not fully configured",
        missingEnvVars: config.missing
      });
    }

    const { roId } = req.params;
    const token = await getAccessToken();

    const ro = await tekmetricGet(
      token,
      `/api/v1/repair-orders/${encodeURIComponent(roId)}`
    );

    const [customer, vehicle, jobs] = await Promise.all([
      tekmetricGet(token, `/api/v1/customers/${encodeURIComponent(ro.customerId)}`),
      tekmetricGet(token, `/api/v1/vehicles/${encodeURIComponent(ro.vehicleId)}`),
      fetchRoJobs(token, roId, ro.shopId)
    ]);

    return res.json({
      success: true,
      roId: ro.id,
      roNumber: ro.repairOrderNumber,
      shopId: ro.shopId,
      mileage: ro.milesOut ?? null,
      completedDate: ro.completedDate ?? null,
      customer,
      vehicle,
      jobs
    });
  } catch (err) {
    console.error("/ro/:roId error", err);
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Internal server error"
    });
  }
});

app.get("/vehicle-history/:vehicleId", async (req, res) => {
  try {
    const config = validateTekmetricConfig();
    if (!config.ok) {
      return res.status(503).json({
        success: false,
        message: "Service not fully configured",
        missingEnvVars: config.missing
      });
    }

    const { vehicleId } = req.params;
    const { shopId } = req.query;

    if (!vehicleId || !shopId) {
      return res.status(400).json({
        success: false,
        message: "vehicleId and shopId are required"
      });
    }

    const token = await getAccessToken();

    const repairOrders = await fetchVehicleRepairOrders(token, vehicleId, shopId);

    let rawTimeline = [];

    for (const ro of repairOrders) {
      const date = ro.completedDate || ro.closedDate || ro.createdDate || null;
      const mileage = ro.milesOut ?? ro.milesIn ?? null;

      if (!date) continue;
      if (!Number.isFinite(Number(mileage))) continue;

      const numericMileage = Number(mileage);
      if (numericMileage <= 0) continue;

      rawTimeline.push({ date, mileage: numericMileage });
    }

    rawTimeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    const mileageTimeline = [];

    for (const entry of rawTimeline) {
      if (mileageTimeline.length === 0) {
        mileageTimeline.push(entry);
        continue;
      }

      const lastValid = mileageTimeline[mileageTimeline.length - 1];
      if (entry.mileage >= lastValid.mileage) {
        mileageTimeline.push(entry);
      }
    }

    let avgMilesPerDay = null;
    let historySpanDays = null;

    if (mileageTimeline.length >= 2) {
      const first = mileageTimeline[0];
      const last = mileageTimeline[mileageTimeline.length - 1];

      const milesDelta = last.mileage - first.mileage;
      const daysDelta = (new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24);

      if (daysDelta > 0 && milesDelta > 0) {
        avgMilesPerDay = milesDelta / daysDelta;
        historySpanDays = Math.round(daysDelta);
      }
    }

    res.json({
      success: true,
      vehicleId,
      mileageTimeline,
      avgMilesPerDay,
      dataPointCount: mileageTimeline.length,
      historySpanDays
    });
  } catch (err) {
    console.error("/vehicle-history error", err);
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Internal server error"
    });
  }
});

app.get("/appointments/counts", async (req, res) => {
  try {
    const config = validateTekmetricConfig();
    if (!config.ok) {
      return res.status(503).json({
        success: false,
        message: "Service not fully configured",
        missingEnvVars: config.missing
      });
    }

    const { shopId, startDate, endDate } = req.query;

    if (!shopId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "shopId, startDate and endDate are required"
      });
    }

    const token = await getAccessToken();
    console.log("Access token:", token);
    const appointments = await fetchAppointmentsForRange(token, shopId, startDate, endDate);

    const counts = {};
    for (const key of buildDateRangeKeys(startDate, endDate)) {
      counts[key] = 0;
    }

    for (const appt of appointments) {
      if (appt.deletedDate) continue;
      if (appt.appointmentStatus === "CANCELLED" || appt.appointmentStatus === "NO_SHOW") continue;

      const key = toDateKey(appt?.startTime || appt?.startDate);
      if (!key) continue;
      if (!(key in counts)) continue;
      counts[key] += 1;
    }

    return res.json({ success: true, counts });
  } catch (err) {
    console.error("/appointments/counts error", err);
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Internal server error"
    });
  }
});

app.post("/appointments", async (req, res) => {
  try {
    const config = validateTekmetricConfig();
    if (!config.ok) {
      return res.status(503).json({
        success: false,
        message: "Service not fully configured",
        missingEnvVars: config.missing
      });
    }

    const {
      shopId, customerId, vehicleId, title, description,
      startTime, endTime, mileage, appointmentType, color
    } = req.body;

    const appointmentColor = typeof color === "string" && color.trim() ? color.trim() : "navy";

    if (!shopId || !customerId || !vehicleId || !title || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "shopId, customerId, vehicleId, title, startTime and endTime are required"
      });
    }

    const token = await getAccessToken();

    let appointmentOption = undefined;
    let dropoffTime = undefined;
    let pickupTime = undefined;

    if (appointmentType === "dropoff") {
      appointmentOption = { id: 2 };
      dropoffTime = startTime;
      pickupTime = endTime;
    } else if (appointmentType === "wait") {
      appointmentOption = { id: 1 };
    }

    const appointmentPayload = {
      shopId, customerId, vehicleId, title, description,
      startTime, endTime, color: appointmentColor,
      rideOption: "NONE", status: "NONE",
      appointmentOption, dropoffTime, pickupTime
    };

    if (mileage != null) {
      appointmentPayload.mileage = mileage;
    }

    const data = await tekmetricRequest(token, "POST", "/api/v1/appointments", appointmentPayload);

    return res.json({ success: true, appointment: data });
  } catch (err) {
    console.error("/appointments error", err);
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Internal server error"
    });
  }
});

/* ============================
   RO Copilot v1.5
============================ */

const DEFAULT_CULTURE_PROFILE = getDefaultCultureProfile();

function buildRoCopilotSources(roContext) {
  const sources = [];
  const pushSource = (sourceId, label, path) => {
    if (!path) return;
    sources.push({ sourceId, label, path, deepLink: path });
  };

  if (roContext?.ro?.id) pushSource("source.ro", `RO #${roContext.ro.repairOrderNumber || roContext.ro.id}`, `/api/v1/repair-orders/${roContext.ro.id}`);
  if (roContext?.customer?.id) pushSource("source.customer", "Customer record", `/api/v1/customers/${roContext.customer.id}`);
  if (roContext?.vehicle?.id) pushSource("source.vehicle", "Vehicle record", `/api/v1/vehicles/${roContext.vehicle.id}`);
  if (Array.isArray(roContext?.jobs) && roContext.jobs.length) pushSource("source.jobs", `${roContext.jobs.length} RO job lines`, `/api/v1/jobs?repairOrderId=${encodeURIComponent(roContext.ro?.id || "")}`);
  if (Array.isArray(roContext?.priorRepairOrders) && roContext.priorRepairOrders.length) pushSource("source.prior_ros", `${roContext.priorRepairOrders.length} prior ROs`, `/api/v1/repair-orders?vehicleId=${encodeURIComponent(roContext.vehicle?.id || "")}`);

  return sources;
}

function normalizeDeclinedPriorHistory(priorRepairOrders) {
  return (priorRepairOrders || [])
    .flatMap((priorRo) => {
      const roJobs = toList(priorRo?.jobs || []);
      return roJobs
        .filter((job) => classifyJobStatus(job) === "declined")
        .map((job) => ({
          id: job?.id || null,
          roId: priorRo?.id || null,
          roNumber: priorRo?.repairOrderNumber || null,
          name: job?.name || job?.title || "Declined item",
          status: normalizeAuthorizationStatus(job)
        }));
    })
    .slice(0, 12);
}

function cleanRoText(value) {
  return String(value || "").replace(/\s+/g, " ").replace(/[|â¢Â·]+/g, " ").trim();
}

function normalizeConcernText(text) {
  const raw = cleanRoText(text).toLowerCase();
  if (!raw) return "";
  return raw
    .replace(/^(perform|inspect|check|replace|service|recommended?|recommendation)\s+/i, "")
    .replace(/\b(customer states|customer reports|client states|complaint|concern)\b[:\-]?/gi, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isServiceNameLike(text) {
  return /\b(oil\s+change|rotation|align(?:ment)?|inspection|maintenance|service\s+[ab]|multi[-\s]?point|flush|balance|tire\s+rotation)\b/i.test(String(text || ""));
}

function isRepairActionLike(text) {
  return /\b(replace|repair|flush|service|perform|install|resurface|adjust|tighten|diagnos|program|alignment|rotation)\b/i.test(String(text || ""));
}

function splitCandidatePhrases(text) {
  return cleanRoText(text)
    .split(/\s*(?:\n|;|,|\.\s+|\/|->|=>|â|\|)\s*/)
    .map((part) => cleanRoText(part))
    .filter(Boolean);
}

function deriveConcernFromJob(job) {
  const directConcern = cleanRoText(job?.customerConcern || job?.complaint || "");
  if (directConcern && !isServiceNameLike(directConcern) && !isRepairActionLike(directConcern)) return directConcern;

  const fromNotes = splitCandidatePhrases(job?.description || job?.notes || "")
    .find((part) => /\b(noise|vibration|shake|leak|warning|light|won['â]?t|fails?|overheat|pull|smell|hard\s+start|stall|rough|misfire|dead)\b/i.test(part));
  if (fromNotes) return fromNotes;

  const fallbackName = cleanRoText(job?.name || job?.title || "Concern");
  return (isServiceNameLike(fallbackName) || isRepairActionLike(fallbackName)) ? "" : fallbackName;
}

function deriveCauseFromJob(job) {
  const explicit = cleanRoText(job?.cause || job?.rootCause || "");
  if (explicit) return explicit;
  return splitCandidatePhrases(job?.description || "")
    .find((part) => /\b(failed?|worn|leaking?|cracked|damaged|contaminated|corroded|low\s+fluid|out\s+of\s+spec|play\s+in|no\s+communication)\b/i.test(part)) || "";
}

function deriveCorrectionFromJob(job) {
  const explicit = cleanRoText(job?.correction || job?.recommendation || job?.recommendedAction || "");
  if (explicit) return explicit;
  return splitCandidatePhrases(job?.description || "")
    .find((part) => /\b(replace|repair|resurface|clean|flush|service|adjust|tighten|diagnos|retest|program)\b/i.test(part)) || "";
}

function buildConcernMap(concerns) {
  const grouped = new Map();

  for (const item of concerns || []) {
    const concernText = cleanRoText(item?.concern || "");
    const key = normalizeConcernText(concernText) || cleanRoText(item?.name || `job-${item?.id || "unknown"}`).toLowerCase();
    if (!grouped.has(key)) {
      grouped.set(key, {
        concernText: concernText || "Concern wording not captured",
        causeText: cleanRoText(item?.likelyCause || "") || "not yet confirmed",
        correctionText: cleanRoText(item?.correction || "") || "correction pending",
        authorization: cleanRoText(item?.authorization || "other") || "other",
        jobs: [],
        declinedInHistory: false,
        comebackRisk: "low"
      });
    }

    const entry = grouped.get(key);
    const causeText = cleanRoText(item?.likelyCause || "");
    const correctionText = cleanRoText(item?.correction || "");
    if (entry.causeText === "not yet confirmed" && causeText) entry.causeText = causeText;
    if (entry.correctionText === "correction pending" && correctionText) entry.correctionText = correctionText;
    if (item?.authorization === "declined") entry.authorization = "declined";
    else if (entry.authorization !== "declined" && item?.authorization === "pending") entry.authorization = "pending";
    else if (entry.authorization === "other" && item?.authorization) entry.authorization = item.authorization;

    entry.jobs.push({
      id: item?.id || null,
      name: cleanRoText(item?.name || "Job line") || "Job line",
      authorization: cleanRoText(item?.authorization || "other") || "other"
    });
  }

  return [...grouped.values()].slice(0, 12);
}

function buildRelevantHistory(concernMap, priorRepairOrders) {
  const priorDeclined = normalizeDeclinedPriorHistory(priorRepairOrders || []);
  const normalizedDeclined = priorDeclined.map((item) => ({
    ...item,
    normalizedName: normalizeConcernText(item?.name || "")
  }));

  return (concernMap || []).map((item) => {
    const concernKey = normalizeConcernText(item.concernText || "");
    const relatedDeclines = normalizedDeclined.filter((d) => {
      if (!concernKey || !d.normalizedName) return false;
      return d.normalizedName.includes(concernKey) || concernKey.includes(d.normalizedName);
    });

    const comebackRisk = /\b(brake|misfire|overheat|leak|safety|steer|suspension|warning\s+light)\b/i.test(
      `${item.concernText} ${item.causeText} ${item.correctionText}`
    ) ? "medium" : "low";

    return {
      ...item,
      declinedInHistory: relatedDeclines.length > 0,
      relatedHistory: relatedDeclines.slice(0, 3).map((d) => ({
        roNumber: d.roNumber, name: d.name, status: d.status
      })),
      comebackRisk
    };
  });
}

function deriveWorkflowStage(context) {
  const flags = context?.completionFlags || {};
  const blockers = [];
  if (!flags.ticketCreationComplete) blockers.push("ticket-created");
  if (!flags.concernCaptureComplete) blockers.push("intake-incomplete");
  if (!flags.dviFindingsPresent) blockers.push("awaiting-dvi");
  if (!flags.causeDocumentationComplete || !flags.correctionDocumentationComplete) blockers.push("findings-in-progress");
  if (!flags.roItemInclusionComplete) blockers.push("ro-build-incomplete");

  let stage = "ready-for-presentation";
  let stageReason = "RO has concern, findings, corrections, and line item inclusion ready for customer presentation.";

  if (!flags.ticketCreationComplete) { stage = "ticket-created"; stageReason = "Ticket exists but base RO details are still incomplete."; }
  else if (!flags.concernCaptureComplete) { stage = "intake-incomplete"; stageReason = "Customer concerns are not clearly captured yet."; }
  else if (!flags.dviFindingsPresent) { stage = "awaiting-dvi"; stageReason = "Waiting on inspection findings before recommendation quality is sufficient."; }
  else if (!flags.causeDocumentationComplete || !flags.correctionDocumentationComplete) { stage = "findings-in-progress"; stageReason = "Findings exist, but cause/correction documentation is still incomplete."; }
  else if (!flags.roItemInclusionComplete) { stage = "ro-build-incomplete"; stageReason = "Cause/correction exists but required RO items and authorization flow are incomplete."; }
  else if (context?.isPresentationSupportMode) { stage = "presentation-support"; stageReason = "RO is ready and advisor is actively in presentation mode."; }

  return { key: stage, reason: stageReason, blockers };
}

function normalizeAuthorizationStatus(job) {
  const status = String(
    job?.authorizationStatus ?? job?.authorizedStatus ??
    job?.approvalStatus ?? job?.status ?? ""
  ).trim();
  const upper = status.toUpperCase();

  if (!upper) return "other";
  if (upper.includes("DECLIN") || upper.includes("REJECT") || upper.includes("UNAUTH")) return "declined";
  if (upper.includes("PEND") || upper.includes("HOLD") || upper.includes("WAIT") || upper.includes("ESTIMATE")) return "pending";
  if (upper.includes("AUTH") || upper.includes("APPROV") || upper.includes("SOLD") || upper.includes("COMPLETE")) return "approved";
  return "other";
}

function deriveInspectionRiskFlags(concerns, authorization) {
  const flags = [];
  const pushFlag = (item) => {
    if (!item) return;
    if (!flags.some((f) => f.concern === item.concern && f.correction === item.correction)) flags.push(item);
  };

  for (const item of concerns || []) {
    const haystack = `${item.concern} ${item.likelyCause} ${item.correction}`;
    if (/\b(brake|abs|steer|suspension|tire\s+cord|unsafe|safety|overheat|coolant\s+leak|fuel\s+leak|misfire|check\s+engine)\b/i.test(haystack)) pushFlag(item);
  }

  if (authorization.declinedCount > 0 && flags.length < 6) {
    pushFlag({ name: "Declined recommendations", concern: "One or more recommendations are currently declined.", likelyCause: "", correction: "Re-present high-value and safety-related items.", authorization: "declined" });
  }

  return flags.slice(0, 6);
}

function buildRepeatConcerns(concerns) {
  const grouped = (concerns || []).reduce((acc, item) => {
    const concern = cleanRoText(item?.concern || "");
    const normalizedConcern = normalizeConcernText(concern);
    if (!normalizedConcern || normalizedConcern.length < 5) return acc;
    const entry = acc.get(normalizedConcern) || { key: normalizedConcern, concern, count: 0, jobs: [] };
    entry.count += 1;
    entry.jobs.push(cleanRoText(item?.name || ""));
    acc.set(normalizedConcern, entry);
    return acc;
  }, new Map());

  return [...grouped.values()].filter((item) => item.count > 1);
}

function normalizeRoCopilotContext(ro, customer, vehicle, jobs, vehicleHistory, priorRepairOrders, appointments) {
  const concerns = jobs
    .map((job) => ({
      id: job?.id || null,
      name: cleanRoText(job?.name || job?.title || "Concern"),
      concern: deriveConcernFromJob(job),
      likelyCause: deriveCauseFromJob(job),
      correction: deriveCorrectionFromJob(job),
      authorization: normalizeAuthorizationStatus(job),
      rawAuthorization: cleanRoText(job?.authorizationStatus || job?.status || "unknown")
    }))
    .filter((item) => item.concern || item.likelyCause || item.correction);

  const authorization = concerns.reduce((acc, item) => {
    if (item.authorization === "approved") acc.approvedCount += 1;
    else if (item.authorization === "declined") acc.declinedCount += 1;
    else if (item.authorization === "pending") acc.pendingCount += 1;
    else acc.otherCount += 1;
    return acc;
  }, { approvedCount: 0, declinedCount: 0, pendingCount: 0, otherCount: 0 });

  const declinedItems = concerns.filter((item) => item.authorization === "declined");
  const missing = [];
  if (!ro?.milesOut && !ro?.milesIn) missing.push("Current mileage not present on RO");
  if (!jobs.length) missing.push("No job lines available");
  if (!concerns.some((c) => c.concern)) missing.push("Concern wording is missing on current job lines");

  const normalizedPriorHistory = normalizeDeclinedPriorHistory(priorRepairOrders);
  const inspectionFlags = deriveInspectionRiskFlags(concerns, authorization);
  const concernMap = buildConcernMap(concerns);
  const concernMapWithHistory = buildRelevantHistory(concernMap, priorRepairOrders);

  const completionFlags = {
    ticketCreationComplete: Boolean(ro?.id && (ro?.repairOrderNumber || ro?.createdDate)),
    concernCaptureComplete: concernMapWithHistory.some((item) => item.concernText && item.concernText !== "Concern wording not captured"),
    dviFindingsPresent: concerns.some((item) => item.likelyCause || item.correction),
    causeDocumentationComplete: concernMapWithHistory.every((item) => item.causeText && item.causeText !== "not yet confirmed"),
    correctionDocumentationComplete: concernMapWithHistory.every((item) => item.correctionText && item.correctionText !== "correction pending"),
    roItemInclusionComplete: concernMapWithHistory.every((item) => item.authorization !== "other"),
    readyToPresent: false
  };
  completionFlags.readyToPresent = Boolean(
    completionFlags.ticketCreationComplete && completionFlags.concernCaptureComplete &&
    completionFlags.dviFindingsPresent && completionFlags.causeDocumentationComplete &&
    completionFlags.correctionDocumentationComplete && completionFlags.roItemInclusionComplete
  );

  const stageInfo = deriveWorkflowStage({ completionFlags });

  const nextActions = [];
  if (!completionFlags.concernCaptureComplete) nextActions.push("Capture exact customer concern wording for each active line.");
  if (!completionFlags.dviFindingsPresent) nextActions.push("Complete DVI/inspection and attach findings before presentation.");
  if (!completionFlags.causeDocumentationComplete) nextActions.push("Document likely cause for each concern or mark as not yet confirmed.");
  if (!completionFlags.correctionDocumentationComplete) nextActions.push("Add explicit correction/recommendation for each concern.");
  if (!completionFlags.roItemInclusionComplete) nextActions.push("Ensure each correction is represented as an RO item with authorization state.");
  if (!nextActions.length) nextActions.push("Move into customer presentation with value/risk explanation by concern.");

  return {
    ro: { id: ro?.id || null, number: ro?.repairOrderNumber || null, shopId: ro?.shopId || null, status: ro?.repairOrderStatus?.name || null, mileage: ro?.milesOut ?? ro?.milesIn ?? null, createdDate: ro?.createdDate || null, updatedDate: ro?.updatedDate || null },
    customer: customer || null,
    vehicle: vehicle || null,
    concerns,
    concernMap: concernMapWithHistory,
    authorization,
    declined: { current: declinedItems.map((item) => ({ id: item.id, name: item.name || "Declined item", status: item.authorization })), priorHistory: normalizedPriorHistory },
    inspection: { available: concerns.some((item) => item.correction || item.likelyCause), flags: inspectionFlags },
    history: { vehicleHistory: vehicleHistory || null, priorRepairOrders: (priorRepairOrders || []).slice(0, 10) },
    appointmentContext: { latest: Array.isArray(appointments) && appointments.length ? appointments[0] : null },
    workflowStage: stageInfo,
    completionFlags,
    nextActions,
    pendingCount: authorization.pendingCount,
    repeatConcerns: buildRepeatConcerns(concerns),
    whatIsMissing: missing,
    sources: buildRoCopilotSources({ ro, customer, vehicle, jobs, priorRepairOrders })
  };
}

async function fetchRoCopilotContext(token, roId) {
  const cached = getCachedRoCopilotContext(roId);
  if (cached) return cached;

  const ro = await tekmetricGet(token, `/api/v1/repair-orders/${encodeURIComponent(roId)}`);
  const [customer, vehicle, jobs] = await Promise.all([
    safeTekmetricGet(token, `/api/v1/customers/${encodeURIComponent(ro.customerId)}`),
    safeTekmetricGet(token, `/api/v1/vehicles/${encodeURIComponent(ro.vehicleId)}`),
    fetchRoJobs(token, roId, ro.shopId)
  ]);

  const [vehicleHistory, priorRepairOrders, appointments] = await Promise.all([
    safeTekmetricGet(token, `/vehicle-history/${encodeURIComponent(ro.vehicleId)}?shopId=${encodeURIComponent(ro.shopId)}`),
    fetchVehicleRepairOrders(token, ro.vehicleId, ro.shopId),
    safeTekmetricGet(token, `/api/v1/appointments?shop=${encodeURIComponent(ro.shopId)}&vehicleId=${encodeURIComponent(ro.vehicleId)}&size=10&page=0`)
  ]);

  const normalized = normalizeRoCopilotContext(ro, customer, vehicle, jobs, vehicleHistory, priorRepairOrders, toList(appointments));
  setCachedRoCopilotContext(roId, normalized);
  return normalized;
}

function buildRuleBasedRoSummary(context) {
  const stage = context.workflowStage?.key || "ticket-created";
  const isReady = Boolean(context.completionFlags?.readyToPresent);

  const completedSteps = [
    context.completionFlags?.ticketCreationComplete ? "Ticket created" : null,
    context.completionFlags?.concernCaptureComplete ? "Customer concerns captured" : null,
    context.completionFlags?.dviFindingsPresent ? "DVI/findings available" : null,
    context.completionFlags?.causeDocumentationComplete ? "Likely causes documented" : null,
    context.completionFlags?.correctionDocumentationComplete ? "Corrections documented" : null,
    context.completionFlags?.roItemInclusionComplete ? "RO items included with authorization state" : null
  ].filter(Boolean);

  const missingNext = toList(context.nextActions);
  const concernMap = toList(context.concernMap).map((item) => ({
    concernText: cleanRoText(item.concernText),
    causeText: cleanRoText(item.causeText),
    correctionText: cleanRoText(item.correctionText),
    authorization: cleanRoText(item.authorization),
    declinedInHistory: Boolean(item.declinedInHistory),
    comebackRisk: cleanRoText(item.comebackRisk || "low"),
    relatedHistory: toList(item.relatedHistory)
  }));

  const confidence = {
    level: context.whatIsMissing.length >= 2 ? "low" : (isReady ? "high" : "medium"),
    note: context.whatIsMissing.length
      ? "Some supporting RO fields are missing; coaching is best-effort until blockers are resolved."
      : "Workflow signals are sufficient for staged advisor coaching."
  };

  return {
    stage: { key: stage, label: stage.replace(/-/g, " "), reason: cleanRoText(context.workflowStage?.reason || "Workflow stage derived from current RO context.") },
    completedSteps,
    missingNext,
    advisorGuidance: [
      context.authorization?.declinedCount > 0 ? `Revisit ${context.authorization.declinedCount} declined item(s) with concern/cause/correction framing.` : "No active declined items to revisit.",
      context.inspection?.flags?.length ? "Address safety/comeback-risk findings before non-critical recommendations." : "No major safety flags detected from available findings."
    ],
    concernMap,
    roCompletenessCheck: {
      readyForPresentation: isReady,
      blockers: missingNext,
      authorizationSummary: { approved: Number(context.authorization?.approvedCount || 0), declined: Number(context.authorization?.declinedCount || 0), pending: Number(context.authorization?.pendingCount || 0), other: Number(context.authorization?.otherCount || 0) }
    },
    salesCoaching: isReady
      ? { prominence: "high", message: "RO is ready to present. Lead with concern-to-correction clarity, then explain risk and value.", objectionRisk: context.authorization?.declinedCount > 0 ? "medium" : "low", comebackRisk: context.inspection?.flags?.length ? "medium" : "low", talkTrack: ["Start with the customer concern in their language.", "Connect each concern to the inspection finding/cause and specific correction.", "Prioritize safety/reliability items first, then maintenance value."] }
      : { prominence: "low", message: "Sales coaching is intentionally limited until the RO is complete enough to present.", objectionRisk: context.authorization?.declinedCount > 0 ? "medium" : "low", comebackRisk: context.inspection?.flags?.length ? "medium" : "low", talkTrack: [] },
    questionHelpers: { groundedFollowUps: ["What is the next best step in this write-up?", "Help me explain this concern map to the customer."], helperChips: ["Explain to me", "Help me sell it", "Help me write notes", "Help me answer customer"] },
    confidence
  };
}

function buildQuestionResponse(context, question, mode) {
  const summary = buildRuleBasedRoSummary(context);
  const normalizedMode = ["advisor", "sales", "notes", "customer"].includes(mode) ? mode : "advisor";
  const lead = summary.missingNext[0] || "Review the available RO details.";
  const answer = `Based on current Tekmetric context: ${lead}`;
  return { mode: normalizedMode, answer, copyText: `${question}\n\n${answer} ${summary.confidence.note}`, confidence: summary.confidence, groundedFollowUps: summary.questionHelpers.groundedFollowUps, sources: context.sources || [] };
}

function stripJsonMarkdownFences(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function extractJsonObjectFromText(text) {
  const cleaned = stripJsonMarkdownFences(text);
  if (!cleaned) return null;
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
  }
}

function normalizeConfidence(confidence) {
  const allowed = ["low", "medium", "high"];
  const level = String(confidence?.level || "").trim().toLowerCase();
  return { level: allowed.includes(level) ? level : "medium", note: String(confidence?.note || "").trim() || "Confidence based on available RO context." };
}

function validateRoCopilotSummary(summary, context = {}) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return { ok: false, reason: "summary payload is not an object", normalized: null };
  if (!summary.stage && (summary.topSummary || summary.whatNeedsAttentionNow || summary.whatsMissing)) return { ok: true, reason: null, normalized: buildRuleBasedRoSummary(context) };

  const stageKey = cleanRoText(summary?.stage?.key || summary?.stageKey || context?.workflowStage?.key || "ticket-created").toLowerCase();
  const allowedStages = ["ticket-created","intake-incomplete","awaiting-dvi","findings-in-progress","ro-build-incomplete","ready-for-presentation","presentation-support"];

  const normalized = {
    stage: { key: allowedStages.includes(stageKey) ? stageKey : (context?.workflowStage?.key || "ticket-created"), label: cleanRoText(summary?.stage?.label || stageKey.replace(/-/g, " ")), reason: cleanRoText(summary?.stage?.reason || context?.workflowStage?.reason || "Workflow stage derived from available RO data.") },
    completedSteps: toList(summary.completedSteps).map((item) => cleanRoText(typeof item === "string" ? item : item?.text || "")).filter(Boolean),
    missingNext: toList(summary.missingNext || context.nextActions || context.whatIsMissing).map((item) => cleanRoText(typeof item === "string" ? item : item?.text || "")).filter(Boolean),
    advisorGuidance: toList(summary.advisorGuidance).map((item) => cleanRoText(typeof item === "string" ? item : item?.text || "")).filter(Boolean),
    concernMap: toList(summary.concernMap || context.concernMap).map((item) => {
      if (typeof item === "string") return { concernText: cleanRoText(item), causeText: "not yet confirmed", correctionText: "correction pending", authorization: "other" };
      return { concernText: cleanRoText(item?.concernText || item?.concern || item?.complaint || item?.name || ""), causeText: cleanRoText(item?.causeText || item?.likelyCause || item?.cause || "not yet confirmed") || "not yet confirmed", correctionText: cleanRoText(item?.correctionText || item?.correction || item?.recommendation || "correction pending") || "correction pending", authorization: cleanRoText(item?.authorization || item?.status || "other") || "other", declinedInHistory: Boolean(item?.declinedInHistory), comebackRisk: cleanRoText(item?.comebackRisk || "low") || "low", relatedHistory: toList(item?.relatedHistory) };
    }).filter((item) => item.concernText || item.causeText || item.correctionText),
    roCompletenessCheck: summary.roCompletenessCheck && typeof summary.roCompletenessCheck === "object"
      ? { readyForPresentation: Boolean(summary.roCompletenessCheck.readyForPresentation), blockers: toList(summary.roCompletenessCheck.blockers).map((x) => cleanRoText(x)).filter(Boolean), authorizationSummary: { approved: Number(summary.roCompletenessCheck.authorizationSummary?.approved || context.authorization?.approvedCount || 0), declined: Number(summary.roCompletenessCheck.authorizationSummary?.declined || context.authorization?.declinedCount || 0), pending: Number(summary.roCompletenessCheck.authorizationSummary?.pending || context.authorization?.pendingCount || 0), other: Number(summary.roCompletenessCheck.authorizationSummary?.other || context.authorization?.otherCount || 0) } }
      : { readyForPresentation: Boolean(context.completionFlags?.readyToPresent), blockers: toList(context.nextActions).map((x) => cleanRoText(x)).filter(Boolean), authorizationSummary: { approved: Number(context.authorization?.approvedCount || 0), declined: Number(context.authorization?.declinedCount || 0), pending: Number(context.authorization?.pendingCount || 0), other: Number(context.authorization?.otherCount || 0) } },
    salesCoaching: summary.salesCoaching && typeof summary.salesCoaching === "object"
      ? { prominence: ["low","high"].includes(String(summary.salesCoaching.prominence||"").toLowerCase()) ? String(summary.salesCoaching.prominence).toLowerCase() : (context.completionFlags?.readyToPresent ? "high" : "low"), message: cleanRoText(summary.salesCoaching.message || ""), objectionRisk: ["low","medium","high"].includes(String(summary.salesCoaching.objectionRisk||"").toLowerCase()) ? String(summary.salesCoaching.objectionRisk).toLowerCase() : (context.authorization?.declinedCount > 0 ? "medium" : "low"), comebackRisk: ["low","medium","high"].includes(String(summary.salesCoaching.comebackRisk||"").toLowerCase()) ? String(summary.salesCoaching.comebackRisk).toLowerCase() : (context.inspection?.flags?.length ? "medium" : "low"), talkTrack: toList(summary.salesCoaching.talkTrack).map((x) => cleanRoText(x)).filter(Boolean) }
      : { prominence: context.completionFlags?.readyToPresent ? "high" : "low", message: context.completionFlags?.readyToPresent ? "RO appears ready for presentation." : "Sales coaching intentionally limited until readiness blockers are cleared.", objectionRisk: context.authorization?.declinedCount > 0 ? "medium" : "low", comebackRisk: context.inspection?.flags?.length ? "medium" : "low", talkTrack: [] },
    questionHelpers: summary.questionHelpers && typeof summary.questionHelpers === "object"
      ? { groundedFollowUps: toList(summary.questionHelpers.groundedFollowUps).map((x) => cleanRoText(x)).filter(Boolean), helperChips: toList(summary.questionHelpers.helperChips).map((x) => cleanRoText(x)).filter(Boolean) }
      : { groundedFollowUps: [], helperChips: [] },
    confidence: normalizeConfidence(summary.confidence)
  };

  if (!normalized.advisorGuidance.length) normalized.advisorGuidance = toList(context.nextActions).slice(0, 3);

  return { ok: true, reason: null, normalized };
}

function validateRoCopilotQuestionResponse(response, context = {}) {
  if (!response || typeof response !== "object" || Array.isArray(response)) return { ok: false, reason: "question response payload is not an object", normalized: null };

  const normalized = {
    answer: cleanRoText(response.answer || response.response || response.summary || ""),
    copyText: cleanRoText(response.copyText || response.answer || response.response || ""),
    groundedFollowUps: toList(response.groundedFollowUps || response.followUps || []).map((item) => cleanRoText(typeof item === "string" ? item : item?.text || "")).filter(Boolean),
    sources: toList(response.sources || context.sources).map((source) => typeof source === "object" ? source : null).filter(Boolean),
    confidence: normalizeConfidence(response.confidence)
  };

  if (!normalized.answer) return { ok: false, reason: "question response answer is empty", normalized: null };
  if (!normalized.copyText) normalized.copyText = normalized.answer;

  return { ok: true, reason: null, normalized };
}

async function safeAnthropicJsonCall({ systemPrompt, userPrompt, maxTokens = 1600 }) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const baseMeta = { anthropicCalled: false, textReturned: false, jsonParseSucceeded: false, model: null, statusCode: null };

  if (!ANTHROPIC_API_KEY) return { ok: false, reason: "ANTHROPIC_API_KEY is not configured", data: null, meta: baseMeta };

  try {
    const fetch = getFetch();
    const requestedModel = process.env.ANTHROPIC_MODEL?.trim();
    const modelFallbacks = [
      requestedModel,
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001"
    ].filter(Boolean);

    let data = null;
    let lastError = null;
    const meta = { ...baseMeta, anthropicCalled: true };

    for (const model of modelFallbacks) {
      meta.model = model;
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: maxTokens, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] })
      });
      meta.statusCode = response.status;

      if (response.ok) { data = await response.json(); break; }

      const errorText = await response.text();
      lastError = `AI service error (${response.status})`;
      console.error(`Anthropic API error for model ${model}:`, response.status, errorText);

      if (response.status !== 404) return { ok: false, reason: lastError, data: null, meta };
    }

    if (!data) return { ok: false, reason: lastError || "AI service unavailable", data: null, meta };

    const text = (data.content || []).filter((block) => block.type === "text").map((block) => block.text).join("\n").trim();
    if (!text) return { ok: false, reason: "Anthropic response did not contain text", data: null, meta };
    meta.textReturned = true;

    const parsed = extractJsonObjectFromText(text);
    if (!parsed) return { ok: false, reason: "Failed to parse JSON object from Anthropic response", data: null, meta };
    meta.jsonParseSucceeded = true;

    return { ok: true, reason: null, data: parsed, meta };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Anthropic request failed", data: null, meta: { ...baseMeta, anthropicCalled: true } };
  }
}

async function safeAnthropicTextCall({ systemPrompt, messages, maxTokens = 600 }) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  const fetch = getFetch();
  // NOTE: modelFallbacks tries each model in order. We continue to the next model
  // ONLY on 404 (model not found). All other errors (5xx, 429, etc.) stop immediately.
  const modelFallbacks = [process.env.ANTHROPIC_MODEL?.trim(), 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'].filter(Boolean);
  let lastError = null;
  for (const model of modelFallbacks) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system: systemPrompt, messages })
    });
    if (response.ok) {
      const data = await response.json();
      return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    }
    const err = await response.text();
    lastError = `AI error (${response.status})`;
    console.error(`safeAnthropicTextCall error for ${model}:`, response.status, err);
    // Only continue to next model on 404 (model not found); stop on all other errors
    if (response.status !== 404) break;
  }
  throw new Error(lastError || 'AI service unavailable');
}

function logRoCopilotDecision(route, payload) {
  console.info(`${route} decision`, payload);
}

app.get("/ro-copilot/context/:roId", async (req, res) => {
  try {
    const config = validateTekmetricConfig();
    if (!config.ok) return res.status(503).json({ success: false, message: "Service not fully configured", missingEnvVars: config.missing });
    const token = await getAccessToken();
    const context = await fetchRoCopilotContext(token, req.params.roId);
    return res.json({ success: true, context, cultureProfile: DEFAULT_CULTURE_PROFILE });
  } catch (err) {
    console.error("/ro-copilot/context/:roId error", err);
    return res.status(500).json({ success: false, message: err instanceof Error ? err.message : "Internal server error" });
  }
});

app.post("/ro-copilot/summary", async (req, res) => {
  try {
    const { context } = req.body || {};
    if (!context || typeof context !== "object") return res.status(400).json({ success: false, message: "context is required" });

    const cultureProfile = DEFAULT_CULTURE_PROFILE;
    const aiResult = await safeAnthropicJsonCall({
      systemPrompt: buildRoCopilotSummarySystemPrompt({ cultureProfile }),
      userPrompt: buildRoCopilotSummaryPrompt({ context, cultureProfile }),
      maxTokens: 1800
    });

    let fallbackUsed = false, fallbackReason = null, validationSucceeded = false;

    if (aiResult.ok) {
      const validated = validateRoCopilotSummary(aiResult.data, context);
      validationSucceeded = validated.ok;
      if (validated.ok) {
        logRoCopilotDecision("/ro-copilot/summary", { anthropicCalled: Boolean(aiResult.meta?.anthropicCalled), textReturned: Boolean(aiResult.meta?.textReturned), jsonParseSucceeded: Boolean(aiResult.meta?.jsonParseSucceeded), validationSucceeded, fallbackUsed, fallbackReason, model: aiResult.meta?.model || null, statusCode: aiResult.meta?.statusCode || null });
        return res.json({ success: true, summary: validated.normalized });
      }
      fallbackUsed = true; fallbackReason = `validation_failed:${validated.reason}`;
    } else {
      fallbackUsed = true; fallbackReason = `anthropic_failed:${aiResult.reason}`;
    }

    logRoCopilotDecision("/ro-copilot/summary", { anthropicCalled: Boolean(aiResult.meta?.anthropicCalled), textReturned: Boolean(aiResult.meta?.textReturned), jsonParseSucceeded: Boolean(aiResult.meta?.jsonParseSucceeded), validationSucceeded, fallbackUsed, fallbackReason, model: aiResult.meta?.model || null, statusCode: aiResult.meta?.statusCode || null });
    return res.json({ success: true, summary: buildRuleBasedRoSummary(context) });
  } catch (err) {
    console.error("/ro-copilot/summary error", err);
    return res.status(500).json({ success: false, message: err instanceof Error ? err.message : "Internal server error" });
  }
});

app.post("/ro-copilot/question", async (req, res) => {
  try {
    const { context, question, mode } = req.body || {};
    if (!context || typeof context !== "object") return res.status(400).json({ success: false, message: "context is required" });
    if (!question || !String(question).trim()) return res.status(400).json({ success: false, message: "question is required" });

    const normalizedMode = String(mode || "advisor").trim().toLowerCase();
    const cultureProfile = DEFAULT_CULTURE_PROFILE;

    const aiResult = await safeAnthropicJsonCall({
      systemPrompt: buildRoCopilotQuestionSystemPrompt({ cultureProfile, mode: normalizedMode }),
      userPrompt: buildRoCopilotQuestionPrompt({ context, cultureProfile, question: String(question).trim(), mode: normalizedMode }),
      maxTokens: 1200
    });

    let fallbackUsed = false, fallbackReason = null, validationSucceeded = false;

    if (aiResult.ok) {
      const validated = validateRoCopilotQuestionResponse(aiResult.data, context);
      validationSucceeded = validated.ok;
      if (validated.ok) {
        logRoCopilotDecision("/ro-copilot/question", { anthropicCalled: Boolean(aiResult.meta?.anthropicCalled), textReturned: Boolean(aiResult.meta?.textReturned), jsonParseSucceeded: Boolean(aiResult.meta?.jsonParseSucceeded), validationSucceeded, fallbackUsed, fallbackReason, model: aiResult.meta?.model || null, statusCode: aiResult.meta?.statusCode || null });
        return res.json({ success: true, response: { mode: ["advisor","sales","notes","customer"].includes(normalizedMode) ? normalizedMode : "advisor", ...validated.normalized } });
      }
      fallbackUsed = true; fallbackReason = `validation_failed:${validated.reason}`;
    } else {
      fallbackUsed = true; fallbackReason = `anthropic_failed:${aiResult.reason}`;
    }

    logRoCopilotDecision("/ro-copilot/question", { anthropicCalled: Boolean(aiResult.meta?.anthropicCalled), textReturned: Boolean(aiResult.meta?.textReturned), jsonParseSucceeded: Boolean(aiResult.meta?.jsonParseSucceeded), validationSucceeded, fallbackUsed, fallbackReason, model: aiResult.meta?.model || null, statusCode: aiResult.meta?.statusCode || null });
    return res.json({ success: true, response: buildQuestionResponse(context, String(question).trim(), normalizedMode) });
  } catch (err) {
    console.error("/ro-copilot/question error", err);
    return res.status(500).json({ success: false, message: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── RO Copilot: Interpret DVI ──────────────────────────────────────────────
app.post('/ro-copilot/interpret-dvi', async (req, res) => {
  try {
    const { dviItems, roContext } = req.body;
    if (!dviItems) return res.status(400).json({ success: false, message: 'dviItems required' });
    const cultureProfile = getDefaultCultureProfile();
    const { system, user } = buildInterpretDviPrompts({ dviItems, roContext, cultureProfile });
    const result = await safeAnthropicJsonCall({ systemPrompt: system, userPrompt: user, maxTokens: 1500 });
    if (!result.ok) return res.status(500).json({ success: false, message: result.reason });
    res.json(result.data);
  } catch (err) {
    console.error('/ro-copilot/interpret-dvi error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── RO Copilot: Part Lookup ────────────────────────────────────────────────
app.post('/ro-copilot/part-lookup', async (req, res) => {
  try {
    const { itemName, roContext } = req.body;
    if (!itemName) return res.status(400).json({ success: false, message: 'itemName required' });
    const cultureProfile = getDefaultCultureProfile();
    const { system, user } = buildPartLookupPrompts({ itemName, roContext, cultureProfile });
    const text = await safeAnthropicTextCall({ systemPrompt: system, messages: [{ role: 'user', content: user }], maxTokens: 400 });
    res.json({ explanation: text });
  } catch (err) {
    console.error('/ro-copilot/part-lookup error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── RO Copilot: Objection Help ─────────────────────────────────────────────
app.post('/ro-copilot/objection-help', async (req, res) => {
  try {
    const { objection, roContext } = req.body;
    if (!objection) return res.status(400).json({ success: false, message: 'objection required' });
    const cultureProfile = getDefaultCultureProfile();
    const { system, user } = buildObjectionHelpPrompts({ objection, roContext, cultureProfile });
    const text = await safeAnthropicTextCall({ systemPrompt: system, messages: [{ role: 'user', content: user }], maxTokens: 400 });
    res.json({ response: text });
  } catch (err) {
    console.error('/ro-copilot/objection-help error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── RO Copilot: Exhaust Assist ─────────────────────────────────────────────
app.post('/ro-copilot/exhaust-assist', async (req, res) => {
  try {
    const { situationType, detail, roContext, history } = req.body;
    if (!situationType) return res.status(400).json({ success: false, message: 'situationType required' });
    const cultureProfile = getDefaultCultureProfile();
    const { system, messages } = buildExhaustAssistPrompts({ situationType, detail, roContext, history, cultureProfile });
    const text = await safeAnthropicTextCall({ systemPrompt: system, messages, maxTokens: 600 });
    res.json({ script: text });
  } catch (err) {
    console.error('/ro-copilot/exhaust-assist error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── RO Copilot: Update Customer ────────────────────────────────────────────
app.patch('/ro-copilot/update-customer', async (req, res) => {
  try {
    const { customerId, fields } = req.body;
    if (!customerId || !fields) return res.status(400).json({ success: false, message: 'customerId and fields required' });
    const token = await getAccessToken();
    const result = await tekmetricRequest(token, 'PATCH', `/api/v1/customers/${customerId}`, fields);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('/ro-copilot/update-customer error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── RO Copilot: Update Job ─────────────────────────────────────────────────
app.patch('/ro-copilot/update-job', async (req, res) => {
  try {
    const { jobId, fields } = req.body;
    if (!jobId || !fields) return res.status(400).json({ success: false, message: 'jobId and fields required' });
    const token = await getAccessToken();
    const result = await tekmetricRequest(token, 'PATCH', `/api/v1/jobs/${jobId}`, fields);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('/ro-copilot/update-job error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── RO Copilot: Add Canned Job to RO ──────────────────────────────────────
app.post('/ro-copilot/add-canned-job', async (req, res) => {
  try {
    const { roId, shopId, serviceName } = req.body;
    if (!roId || !shopId || !serviceName) return res.status(400).json({ success: false, message: 'roId, shopId, and serviceName required' });
    const token = await getAccessToken();
    const searchResult = await tekmetricRequest(token, 'GET', `/api/v1/canned-jobs?shopId=${shopId}&search=${encodeURIComponent(serviceName)}&size=5`);
    const jobs = searchResult?.content || (Array.isArray(searchResult) ? searchResult : []);
    if (jobs.length === 0) return res.json({ success: false, reason: 'no-canned-job-found' });
    const cannedJobId = jobs[0].id;
    await tekmetricRequest(token, 'POST', `/api/v1/repair-orders/${roId}/canned-jobs`, { cannedJobIds: [cannedJobId] });
    res.json({ success: true, cannedJobId, cannedJobName: jobs[0].name });
  } catch (err) {
    console.error('/ro-copilot/add-canned-job error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ============================
   AI Chat Proxy (Anthropic Claude)
============================ */

function classifyJobStatus(job) {
  const normalized = normalizeAuthorizationStatus(job);
  if (normalized === "approved" || normalized === "declined") return normalized;
  return "other";
}

app.post("/ai/chat", async (req, res) => {
  try {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) {
      return res.status(503).json({
        success: false,
        message: "AI service not configured. Set ANTHROPIC_API_KEY environment variable."
      });
    }

    const { module, messages, context } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "messages array is required and must not be empty"
      });
    }

    const systemPrompt = buildAISystemPrompt(module || "assistant", context || null);

    const maxTokens = module === "vehicle" ? 1500 : 1024;

    const fetch = getFetch();
    const requestedModel = process.env.ANTHROPIC_MODEL?.trim();
    const modelFallbacks = [
      requestedModel,
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001"
    ].filter(Boolean);

    const normalizedMessages = messages
      .map((m) => ({
        role: m?.role,
        content: typeof m?.content === "string" ? m.content : String(m?.content ?? "")
      }))
      .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim());

    if (normalizedMessages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "messages must include at least one non-empty user/assistant message"
      });
    }

    let data = null;
    let lastError = null;

    for (const model of modelFallbacks) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: normalizedMessages
        })
      });

      if (response.ok) {
        data = await response.json();
        break;
      }

      const errorText = await response.text();
      lastError = `AI service error (${response.status})`;
      console.error(`Anthropic API error for model ${model}:`, response.status, errorText);

      if (response.status !== 400 && response.status !== 404) {
        throw new Error(lastError);
      }
    }

    if (!data) {
      throw new Error(lastError || "AI service unavailable");
    }

    const text = (data.content || [])
      .filter(block => block.type === "text")
      .map(block => block.text)
      .join("\n");

    return res.json({
      success: true,
      text,
      usage: data.usage || null,
      stopReason: data.stop_reason || null
    });
  } catch (err) {
    console.error("/ai/chat error", err);
    return res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "AI chat failed"
    });
  }
});

app.get("/ai/health", (req, res) => {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  res.json({ ok: true, aiConfigured: hasKey });
});

app.use((err, req, res, next) => {
  console.error("Unhandled express error", err);
  if (res.headersSent) return next(err);
  return res.status(500).json({ success: false, message: "Unhandled server error" });
});

process.on("unhandledRejection", (reason) => { console.error("Unhandled promise rejection", reason); });
process.on("uncaughtException", (err) => { console.error("Uncaught exception", err); });

/* ============================
   Start Server
============================ */

const PORT = Number.parseInt(process.env.PORT || "8080", 10);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
