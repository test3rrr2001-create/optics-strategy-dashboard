import { createClient } from "@supabase/supabase-js";

const PROJECT_LABELS = {
  microscope: "顕微鏡",
  industrial_endoscope: "工業用内視鏡",
  pipe_camera: "管内カメラ",
  beauty: "美容用"
};

const PROJECT_ID_TO_KEY = {
  1: "microscope",
  2: "industrial_endoscope",
  3: "pipe_camera",
  4: "beauty"
};

const PROJECT_ID_TO_LABEL = {
  1: "顕微鏡",
  2: "工業用内視鏡",
  3: "管内カメラ",
  4: "美容用"
};

function normalizeProjectKey(value) {
  if (!value) return "";
  return String(value).trim().toLowerCase();
}

function resolveCardKey(projectId, projectName) {
  const idKey = PROJECT_ID_TO_KEY[Number(projectId)];
  if (idKey) return idKey;

  const normalized = normalizeProjectKey(projectName);
  if (!normalized) return "";

  const aliases = {
    microscope: ["microscope", "顕微鏡"],
    industrial_endoscope: ["industrial_endoscope", "工業用内視鏡"],
    pipe_camera: ["pipe_camera", "管内カメラ"],
    beauty: ["beauty", "美容用"]
  };

  for (const [key, values] of Object.entries(aliases)) {
    if (values.some((v) => normalizeProjectKey(v) === normalized)) {
      return key;
    }
  }

  return "";
}

function getQueryValue(req, key) {
  if (req?.query && typeof req.query[key] !== "undefined") {
    return req.query[key] || "";
  }

  try {
    const base = req?.headers?.host
      ? `https://${req.headers.host}`
      : "http://localhost";
    const url = new URL(req.url || "", base);
    return url.searchParams.get(key) || "";
  } catch {
    return "";
  }
}

function getProjectLabel(project) {
  if (!project || typeof project !== "object") return "";
  return (
    project.name ||
    project.project_name ||
    project.title ||
    project.project ||
    ""
  );
}

// ===== 頻出ワード抽出 =====
const STOPWORDS = new Set([
  "の","に","は","を","た","が","で","て","と","し","れ","さ","ある","いる","も","する","から","な",
  "こと","として","い","や","れる","など","なっ","ない","この","ため","その","あっ","よう","また",
  "もの","という","あり","まで","られ","なる","へ","か","だ","これ","によって","により","おり","より",
  "による","ず","なり","られる","において","ば","なかっ","なく","しかし","について","せ","だっ","その後",
  "できる","それ","う","ので","なお","のみ","でき","き","つ","における","および","いう","さらに","でも",
  "ら","たり","その他","に関して","に対して","では","ます","です","まし","まして","こちら","あちら",
  "the","a","an","and","or","but","in","on","at","to","for","of","with","by","from","is","are",
  "was","were","be","been","have","has","had","do","does","did","will","would","could","should",
  "may","might","it","its","this","that","these","those","i","we","you","he","she","they"
]);

function extractWords(text) {
  if (!text) return [];
  const tokens = [];
  const enWords = text.match(/[A-Za-z][A-Za-z0-9\-]{1,}/g) || [];
  enWords.forEach(w => { if (!STOPWORDS.has(w.toLowerCase())) tokens.push(w); });
  const jaWords = text.match(/[\u3040-\u9FFF\u30A0-\u30FF]{2,8}/g) || [];
  jaWords.forEach(w => { if (!STOPWORDS.has(w)) tokens.push(w); });
  return tokens;
}

function buildWordFrequency(rows, projectNameById, topN = 20) {
  const freqAll = {};
  const freqByProject = {};

  for (const row of rows) {
    const words = extractWords(row.title);
    const projectKey = resolveCardKey(row.project_id,
      projectNameById[row.project_id] || String(row.project_id || ""));

    for (const word of words) {
      freqAll[word] = (freqAll[word] || 0) + 1;
      if (projectKey) {
        if (!freqByProject[projectKey]) freqByProject[projectKey] = {};
        freqByProject[projectKey][word] = (freqByProject[projectKey][word] || 0) + 1;
      }
    }
  }

  function toTopN(freq) {
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([word, count]) => ({ word, count }));
  }

  const result = { all: toTopN(freqAll) };
  for (const [key, freq] of Object.entries(freqByProject)) {
    result[key] = toTopN(freq);
  }
  return result;
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
      (projects || []).map((p) => [p.id, getProjectLabel(p) || PROJECT_ID_TO_LABEL[p.id]])
    );

    let query = supabase
      .from("daily_results")
      .select(
        "id, project_id, keyword, title, url, source, published_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (project) query = query.eq("project_id", project);
    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);
    if (keyword) query = query.ilike("keyword", `%${keyword}%`);

    const { data: rows, error: rowsError } = await query;

    if (rowsError) {
      throw new Error(`daily_results fetch error: ${rowsError.message}`);
    }

    const projectCounts = {};
    const sourceCounts = {};
    const dayCounts = {};

    for (const row of rows || []) {
      const projectName =
        projectNameById[row.project_id] || String(row.project_id || "未設定");
      projectCounts[projectName] = (projectCounts[projectName] || 0) + 1;

      const source = row.source || "unknown";
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;

      const date = row.created_at
        ? new Date(row.created_at).toISOString().slice(0, 10)
        : "unknown";
      dayCounts[date] = (dayCounts[date] || 0) + 1;
    }

    const cardCounts = {
      total: (rows || []).length,
      microscope: 0,
      industrial_endoscope: 0,
      pipe_camera: 0,
      beauty: 0
    };

    for (const row of rows || []) {
      const projectName =
        projectNameById[row.project_id] || String(row.project_id || "");
      const cardKey = resolveCardKey(row.project_id, projectName);
      if (cardKey) cardCounts[cardKey] += 1;
    }

    const byDaySorted = Object.entries(dayCounts)
      .filter(([d]) => d !== "unknown")
      .sort((a, b) => (a[0] < b[0] ? -1 : 1));

    // 頻出ワード集計
    const wordFrequency = buildWordFrequency(rows || [], projectNameById, 20);

    res.status(200).json({
      filters: { project, dateFrom, dateTo, keyword },
      projects: (projects || []).map((p) => ({
        id: p.id,
        name: getProjectLabel(p) || PROJECT_ID_TO_LABEL[p.id] || String(p.id || "")
      })),
      counts: {
        ...cardCounts,
        by_project: projectCounts,
        by_source: sourceCounts,
        by_day: Object.fromEntries(byDaySorted)
      },
      chart: {
        project: Object.entries(projectCounts),
        source: Object.entries(sourceCounts),
        day: byDaySorted
      },
      wordFrequency,
      items: (rows || []).map((row) => ({
        ...row,
        project_name:
          projectNameById[row.project_id] || PROJECT_ID_TO_LABEL[row.project_id] || String(row.project_id || "未設定")
      }))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
