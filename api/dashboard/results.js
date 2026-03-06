import { createClient } from "@supabase/supabase-js";

const PROJECT_LABELS = {
  microscope: "顕微鏡",
  industrial_endoscope: "工業用内視鏡",
  pipe_camera: "管内カメラ",
  beauty: "美容用"
};

function normalizeProjectKey(value) {
  if (!value) return "";
  return String(value).trim().toLowerCase();
}

function getQueryValue(req, key) {
  if (req?.query && typeof req.query[key] !== "undefined") {
    return req.query[key] || "";
  }

  try {
    const base = req?.headers?.host ? `https://${req.headers.host}` : "http://localhost";
    const url = new URL(req.url || "", base);
    return url.searchParams.get(key) || "";
  } catch {
    return "";
  }
}

function getProjectLabel(project) {
  if (!project || typeof project !== "object") return "";
  return project.name || project.project_name || project.title || project.project || "";
}

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const project = getQueryValue(req, "project");
    const dateFrom = getQueryValue(req, "dateFrom");
    const dateTo = getQueryValue(req, "dateTo");
    const keyword = getQueryValue(req, "keyword");

    const { data: projects, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .limit(200);

    if (projectError) {
      console.warn(`projects fetch warning: ${projectError.message}`);
    }

    const projectNameById = Object.fromEntries(
      (projects || []).map((p) => [p.id, getProjectLabel(p)])
    );

    let query = supabase
      .from("daily_results")
      .select("id, project_id, keyword, title, url, source, published_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (project) query = query.eq("project_id", project);
    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);
    if (keyword) query = query.ilike("keyword", `%${keyword}%`);

    const { data: rows, error: rowsError } = await query;
    if (rowsError) throw new Error(`daily_results fetch error: ${rowsError.message}`);

    const projectCounts = {};
    const sourceCounts = {};

    for (const row of rows || []) {
      const name = projectNameById[row.project_id] || String(row.project_id || "未設定");
      projectCounts[name] = (projectCounts[name] || 0) + 1;
      sourceCounts[row.source || "unknown"] = (sourceCounts[row.source || "unknown"] || 0) + 1;
    }

    const cardCounts = {
      total: (rows || []).length,
      microscope: 0,
      industrial_endoscope: 0,
      pipe_camera: 0,
      beauty: 0
    };

    for (const [projectName, count] of Object.entries(projectCounts)) {
      const key = normalizeProjectKey(projectName);
      const labelKey = Object.keys(PROJECT_LABELS).find(
        (k) => k === key || PROJECT_LABELS[k] === projectName
      );
      if (labelKey) cardCounts[labelKey] += count;
    }

    res.status(200).json({
      filters: { project, dateFrom, dateTo, keyword },
      projects: (projects || []).map((p) => ({
        id: p.id,
        name: getProjectLabel(p) || String(p.id || "")
      })),
      counts: {
        ...cardCounts,
        by_project: projectCounts,
        by_source: sourceCounts
      },
      items: (rows || []).map((row) => ({
        ...row,
        project_name: projectNameById[row.project_id] || String(row.project_id || "未設定")
      }))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
