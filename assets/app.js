const state = {
  itemsAi: [],
  itemsAll: [],
  itemsAllRaw: [],
  statsAi: [],
  totalAi: 0,
  totalRaw: 0,
  totalAllMode: 0,
  allDedup: true,
  siteFilter: "",
  query: "",
  mode: "ai",
  waytoagiMode: "today",
  waytoagiData: null,
  generatedAt: null,
  starredUrls: new Set(),
  showStarredOnly: false,
};

const STORAGE_KEY_STARRED = "xl-ai-news-starred-v1";

const statsEl = document.getElementById("stats");
const siteSelectEl = document.getElementById("siteSelect");
const sitePillsEl = document.getElementById("sitePills");
const newsListEl = document.getElementById("newsList");
const updatedAtEl = document.getElementById("updatedAt");
const searchInputEl = document.getElementById("searchInput");
const resultCountEl = document.getElementById("resultCount");
const itemTpl = document.getElementById("itemTpl");
const modeAiBtnEl = document.getElementById("modeAiBtn");
const modeAllBtnEl = document.getElementById("modeAllBtn");
const modeHintEl = document.getElementById("modeHint");
const allDedupeWrapEl = document.getElementById("allDedupeWrap");
const allDedupeToggleEl = document.getElementById("allDedupeToggle");
const allDedupeLabelEl = document.getElementById("allDedupeLabel");

const waytoagiUpdatedAtEl = document.getElementById("waytoagiUpdatedAt");
const waytoagiMetaEl = document.getElementById("waytoagiMeta");
const waytoagiListEl = document.getElementById("waytoagiList");
const waytoagiTodayBtnEl = document.getElementById("waytoagiTodayBtn");
const waytoagi7dBtnEl = document.getElementById("waytoagi7dBtn");

const starFilterBtnEl = document.getElementById("starFilterBtn");
const starCountEl = document.getElementById("starCount");
const hotTopicsListEl = document.getElementById("hotTopicsList");
const hotTopicsHintEl = document.getElementById("hotTopicsHint");

function fmtNumber(n) {
  return new Intl.NumberFormat("zh-CN").format(n || 0);
}

/**
 * 从LocalStorage加载星标数据
 */
function loadStarredFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STARRED);
    if (raw) {
      const arr = JSON.parse(raw);
      state.starredUrls = new Set(arr);
    }
  } catch (e) {
    state.starredUrls = new Set();
  }
}

/**
 * 保存星标数据到LocalStorage
 */
function saveStarredToStorage() {
  try {
    const arr = Array.from(state.starredUrls);
    localStorage.setItem(STORAGE_KEY_STARRED, JSON.stringify(arr));
  } catch (e) {
    console.error("Failed to save starred items:", e);
  }
}

/**
 * 切换星标状态
 * @param {string} url - 新闻URL
 * @param {object} item - 新闻对象
 */
function toggleStar(url, item) {
  if (state.starredUrls.has(url)) {
    state.starredUrls.delete(url);
  } else {
    state.starredUrls.add(url);
  }
  saveStarredToStorage();
  updateStarCount();
  renderList();
}

/**
 * 更新星标计数显示
 */
function updateStarCount() {
  if (starCountEl) {
    starCountEl.textContent = state.starredUrls.size;
  }
  if (starFilterBtnEl) {
    starFilterBtnEl.classList.toggle("active", state.showStarredOnly);
  }
}

/**
 * 导出星标数据为JSON（供智能体使用）
 */
function exportStarredData() {
  const allItems = [...state.itemsAi, ...state.itemsAllRaw];
  const starredItems = allItems.filter(item => state.starredUrls.has(item.url));
  
  const exportData = {
    exported_at: new Date().toISOString(),
    total_count: starredItems.length,
    items: starredItems.map(item => ({
      title: item.title,
      title_zh: item.title_zh || "",
      title_en: item.title_en || "",
      url: item.url,
      site_name: item.site_name,
      source: item.source,
      published_at: item.published_at || item.first_seen_at
    }))
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `starred-news-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function fmtTime(iso) {
  if (!iso) return "时间未知";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * 渲染热门话题区域
 * @param {Array} hotTopics - 热门话题列表
 * @param {Array} hotCrossSite - 热门转载新闻列表
 */
function renderHotTopics(hotTopics, hotCrossSite) {
  if (!hotTopicsListEl) return;
  
  hotTopicsListEl.innerHTML = "";
  
  if (hotCrossSite && hotCrossSite.length > 0) {
    const sectionTitle = document.createElement("div");
    sectionTitle.className = "hot-section-title";
    sectionTitle.innerHTML = "<b>🔥 热门转载</b> <span class='hot-section-hint'>多平台都在报道</span>";
    hotTopicsListEl.appendChild(sectionTitle);
    
    hotCrossSite.slice(0, 10).forEach((item, index) => {
      const tag = document.createElement("button");
      tag.className = "hot-topic-tag hot-cross-site";
      const siteCount = item.cross_site_count || 1;
      tag.innerHTML = `${item.title_zh || item.title || "未知标题"}`.slice(0, 30) + `... <span class="hot-topic-count">${siteCount}平台</span>`;
      tag.onclick = () => toggleHotCrossSiteDetail(item, tag);
      hotTopicsListEl.appendChild(tag);
    });
  }
  
  if (hotTopics && hotTopics.length > 0) {
    const sectionTitle = document.createElement("div");
    sectionTitle.className = "hot-section-title";
    sectionTitle.style.marginTop = hotCrossSite && hotCrossSite.length > 0 ? "16px" : "0";
    sectionTitle.innerHTML = "<b>📊 热门关键词</b> <span class='hot-section-hint'>高频话题</span>";
    hotTopicsListEl.appendChild(sectionTitle);
    
    hotTopics.slice(0, 15).forEach((topic, index) => {
      const tag = document.createElement("button");
      tag.className = "hot-topic-tag";
      tag.innerHTML = `${topic.keyword}<span class="hot-topic-count">${topic.count}</span>`;
      tag.onclick = () => toggleHotTopicDetail(topic, tag);
      hotTopicsListEl.appendChild(tag);
    });
  }
}

/**
 * 切换热门话题详情显示
 * @param {Object} topic - 话题对象
 * @param {HTMLElement} tagEl - 标签元素
 */
function toggleHotTopicDetail(topic, tagEl) {
  const allTags = hotTopicsListEl.querySelectorAll(".hot-topic-tag");
  allTags.forEach(t => t.classList.remove("active"));
  
  let detailEl = hotTopicsListEl.querySelector(".hot-topics-items");
  
  if (detailEl && detailEl.dataset.keyword === topic.keyword) {
    detailEl.remove();
    return;
  }
  
  if (detailEl) detailEl.remove();
  
  tagEl.classList.add("active");
  
  detailEl = document.createElement("div");
  detailEl.className = "hot-topics-items visible";
  detailEl.dataset.keyword = topic.keyword;
  
  const title = document.createElement("h4");
  title.textContent = `"${topic.keyword}" 相关新闻 (${topic.count}条)`;
  detailEl.appendChild(title);
  
  topic.related_items.forEach(item => {
    const itemEl = document.createElement("div");
    itemEl.className = "hot-topic-item";
    
    const siteEl = document.createElement("span");
    siteEl.className = "hot-topic-item-site";
    siteEl.textContent = item.site_name || "未知来源";
    
    const linkEl = document.createElement("a");
    linkEl.className = "hot-topic-item-title";
    linkEl.href = item.url;
    linkEl.target = "_blank";
    linkEl.rel = "noopener noreferrer";
    linkEl.textContent = item.title_zh || item.title || "无标题";
    
    itemEl.appendChild(siteEl);
    itemEl.appendChild(linkEl);
    detailEl.appendChild(itemEl);
  });
  
  hotTopicsListEl.appendChild(detailEl);
}

/**
 * 切换热门转载新闻详情显示
 * @param {Object} item - 新闻对象
 * @param {HTMLElement} tagEl - 标签元素
 */
function toggleHotCrossSiteDetail(item, tagEl) {
  const allTags = hotTopicsListEl.querySelectorAll(".hot-topic-tag");
  allTags.forEach(t => t.classList.remove("active"));
  
  let detailEl = hotTopicsListEl.querySelector(".hot-topics-items");
  
  if (detailEl && detailEl.dataset.url === item.url) {
    detailEl.remove();
    return;
  }
  
  if (detailEl) detailEl.remove();
  
  tagEl.classList.add("active");
  
  detailEl = document.createElement("div");
  detailEl.className = "hot-topics-items visible";
  detailEl.dataset.url = item.url;
  
  const title = document.createElement("h4");
  title.textContent = item.title_zh || item.title || "无标题";
  detailEl.appendChild(title);
  
  const metaInfo = document.createElement("div");
  metaInfo.className = "hot-cross-meta";
  metaInfo.innerHTML = `<span class="hot-cross-count">被 ${item.cross_site_count} 个平台转载</span>`;
  detailEl.appendChild(metaInfo);
  
  const linkEl = document.createElement("a");
  linkEl.className = "hot-topic-item-title";
  linkEl.href = item.url;
  linkEl.target = "_blank";
  linkEl.rel = "noopener noreferrer";
  linkEl.textContent = "查看原文 →";
  linkEl.style.display = "inline-block";
  linkEl.style.marginTop = "8px";
  detailEl.appendChild(linkEl);
  
  if (item.all_occurrences && item.all_occurrences.length > 0) {
    const occTitle = document.createElement("div");
    occTitle.className = "hot-occurrences-title";
    occTitle.textContent = "转载来源：";
    occTitle.style.marginTop = "12px";
    occTitle.style.fontSize = "12px";
    occTitle.style.color = "#666";
    detailEl.appendChild(occTitle);
    
    item.all_occurrences.forEach(occ => {
      const occEl = document.createElement("div");
      occEl.className = "hot-topic-item";
      occEl.style.padding = "6px 0";
      
      const siteEl = document.createElement("span");
      siteEl.className = "hot-topic-item-site";
      siteEl.textContent = occ.site_name || "未知来源";
      
      const sourceEl = document.createElement("span");
      sourceEl.style.marginLeft = "8px";
      sourceEl.style.fontSize = "11px";
      sourceEl.style.color = "#999";
      sourceEl.textContent = occ.source || "";
      
      occEl.appendChild(siteEl);
      occEl.appendChild(sourceEl);
      detailEl.appendChild(occEl);
    });
  }
  
  hotTopicsListEl.appendChild(detailEl);
}

function fmtDate(iso) {
  if (!iso) return "未知日期";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function setStats(payload) {
  const cards = [
    ["24h AI", fmtNumber(payload.total_items)],
    ["24h 全量", fmtNumber(payload.total_items_raw || payload.total_items)],
    ["全量去重后", fmtNumber(payload.total_items_all_mode || payload.total_items_raw || payload.total_items)],
    ["站点数", fmtNumber(payload.site_count)],
    ["来源分组", fmtNumber(payload.source_count)],
    ["归档总量", fmtNumber(payload.archive_total || 0)]
  ];

  statsEl.innerHTML = "";
  cards.forEach(([k, v]) => {
    const node = document.createElement("div");
    node.className = "stat";
    node.innerHTML = `<div class="k">${k}</div><div class="v">${v}</div>`;
    statsEl.appendChild(node);
  });
}

function computeSiteStats(items) {
  const m = new Map();
  items.forEach((item) => {
    if (!m.has(item.site_id)) {
      m.set(item.site_id, { site_id: item.site_id, site_name: item.site_name, count: 0, raw_count: 0 });
    }
    const row = m.get(item.site_id);
    row.count += 1;
    row.raw_count += 1;
  });
  return Array.from(m.values()).sort((a, b) => b.count - a.count || a.site_name.localeCompare(b.site_name, "zh-CN"));
}

function currentSiteStats() {
  if (state.mode === "ai") return state.statsAi || [];
  return computeSiteStats(state.allDedup ? (state.itemsAll || []) : (state.itemsAllRaw || []));
}

function renderSiteFilters() {
  const stats = currentSiteStats();

  siteSelectEl.innerHTML = '<option value="">全部站点</option>';
  stats.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.site_id;
    const raw = s.raw_count ?? s.count;
    opt.textContent = `${s.site_name} (${s.count}/${raw})`;
    siteSelectEl.appendChild(opt);
  });
  siteSelectEl.value = state.siteFilter;

  sitePillsEl.innerHTML = "";
  const allPill = document.createElement("button");
  allPill.className = `pill ${state.siteFilter === "" ? "active" : ""}`;
  allPill.textContent = "全部";
  allPill.onclick = () => {
    state.siteFilter = "";
    renderSiteFilters();
    renderList();
  };
  sitePillsEl.appendChild(allPill);

  stats.forEach((s) => {
    const btn = document.createElement("button");
    btn.className = `pill ${state.siteFilter === s.site_id ? "active" : ""}`;
    const raw = s.raw_count ?? s.count;
    btn.textContent = `${s.site_name} ${s.count}/${raw}`;
    btn.onclick = () => {
      state.siteFilter = s.site_id;
      renderSiteFilters();
      renderList();
    };
    sitePillsEl.appendChild(btn);
  });
}

function renderModeSwitch() {
  modeAiBtnEl.classList.toggle("active", state.mode === "ai");
  modeAllBtnEl.classList.toggle("active", state.mode === "all");
  if (allDedupeWrapEl) allDedupeWrapEl.classList.toggle("show", state.mode === "all");
  if (allDedupeToggleEl) allDedupeToggleEl.checked = state.allDedup;
  if (allDedupeLabelEl) allDedupeLabelEl.textContent = state.allDedup ? "去重开" : "去重关";
  if (state.mode === "ai") {
    modeHintEl.textContent = `当前视图：AI强相关（${fmtNumber(state.totalAi)} 条）`;
  } else {
    const allCount = state.allDedup
      ? (state.totalAllMode || state.itemsAll.length)
      : (state.totalRaw || state.itemsAllRaw.length);
    modeHintEl.textContent = `当前视图：全量（${state.allDedup ? "去重开" : "去重关"}，${fmtNumber(allCount)} 条）`;
  }
}

function effectiveAllItems() {
  return state.allDedup ? state.itemsAll : state.itemsAllRaw;
}

function modeItems() {
  return state.mode === "all" ? effectiveAllItems() : state.itemsAi;
}

function getFilteredItems() {
  const q = state.query.trim().toLowerCase();
  return modeItems().filter((item) => {
    if (state.siteFilter && item.site_id !== state.siteFilter) return false;
    if (state.showStarredOnly && !state.starredUrls.has(item.url)) return false;
    if (!q) return true;
    const hay = `${item.title || ""} ${item.title_zh || ""} ${item.title_en || ""} ${item.site_name || ""} ${item.source || ""}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderItemNode(item) {
  const node = itemTpl.content.firstElementChild.cloneNode(true);
  node.querySelector(".site").textContent = item.site_name;
  node.querySelector(".source").textContent = `分区: ${item.source}`;
  node.querySelector(".time").textContent = fmtTime(item.published_at || item.first_seen_at);

  const titleEl = node.querySelector(".title");
  const zh = (item.title_zh || "").trim();
  const en = (item.title_en || "").trim();
  titleEl.textContent = "";
  if (zh && en && zh !== en) {
    const primary = document.createElement("span");
    primary.textContent = zh;
    const sub = document.createElement("span");
    sub.className = "title-sub";
    sub.textContent = en;
    titleEl.appendChild(primary);
    titleEl.appendChild(sub);
  } else {
    titleEl.textContent = item.title || zh || en;
  }
  titleEl.href = item.url;
  titleEl.title = item.url;

  const starBtn = node.querySelector(".star-toggle");
  if (starBtn) {
    const isStarred = state.starredUrls.has(item.url);
    starBtn.textContent = isStarred ? "★" : "☆";
    starBtn.classList.toggle("starred", isStarred);
    starBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleStar(item.url, item);
    });
  }

  return node;
}

function buildSourceGroupNode(source, items) {
  const section = document.createElement("section");
  section.className = "source-group";
  section.innerHTML = `
    <header class="source-group-head">
      <h3>${source}</h3>
      <span>${fmtNumber(items.length)} 条</span>
    </header>
    <div class="source-group-list"></div>
  `;
  const listEl = section.querySelector(".source-group-list");
  items.forEach((item) => listEl.appendChild(renderItemNode(item)));
  return section;
}

function groupBySource(items) {
  const groupMap = new Map();
  items.forEach((item) => {
    const key = item.source || "未分区";
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key).push(item);
  });

  return Array.from(groupMap.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "zh-CN"));
}

function renderGroupedBySource(items) {
  const groups = groupBySource(items);
  const frag = document.createDocumentFragment();

  groups.forEach(([source, groupItems]) => {
    frag.appendChild(buildSourceGroupNode(source, groupItems));
  });

  newsListEl.appendChild(frag);
}

function renderGroupedBySiteAndSource(items) {
  const siteMap = new Map();
  items.forEach((item) => {
    if (!siteMap.has(item.site_id)) {
      siteMap.set(item.site_id, {
        siteName: item.site_name || item.site_id,
        items: [],
      });
    }
    siteMap.get(item.site_id).items.push(item);
  });

  const sites = Array.from(siteMap.entries()).sort((a, b) => {
    const byCount = b[1].items.length - a[1].items.length;
    if (byCount !== 0) return byCount;
    return a[1].siteName.localeCompare(b[1].siteName, "zh-CN");
  });

  const frag = document.createDocumentFragment();
  sites.forEach(([, site]) => {
    const siteSection = document.createElement("section");
    siteSection.className = "site-group";
    siteSection.innerHTML = `
      <header class="site-group-head">
        <h3>${site.siteName}</h3>
        <span>${fmtNumber(site.items.length)} 条</span>
      </header>
      <div class="site-group-list"></div>
    `;

    const siteListEl = siteSection.querySelector(".site-group-list");
    const sourceGroups = groupBySource(site.items);
    sourceGroups.forEach(([source, groupItems]) => {
      siteListEl.appendChild(buildSourceGroupNode(source, groupItems));
    });
    frag.appendChild(siteSection);
  });

  newsListEl.appendChild(frag);
}

function renderList() {
  const filtered = getFilteredItems();
  resultCountEl.textContent = `${fmtNumber(filtered.length)} 条`;

  newsListEl.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "当前筛选条件下没有结果。";
    newsListEl.appendChild(empty);
    return;
  }

  if (state.siteFilter) {
    renderGroupedBySource(filtered);
    return;
  }

  renderGroupedBySiteAndSource(filtered);
}

function waytoagiViews(waytoagi) {
  const updates7d = Array.isArray(waytoagi?.updates_7d) ? waytoagi.updates_7d : [];
  const latestDate = waytoagi?.latest_date || (updates7d.length ? updates7d[0].date : null);
  const updatesToday = Array.isArray(waytoagi?.updates_today) && waytoagi.updates_today.length
    ? waytoagi.updates_today
    : (latestDate ? updates7d.filter((u) => u.date === latestDate) : []);
  return { updates7d, updatesToday, latestDate };
}

function renderWaytoagi(waytoagi) {
  const { updates7d, updatesToday, latestDate } = waytoagiViews(waytoagi);
  if (waytoagiTodayBtnEl) waytoagiTodayBtnEl.classList.toggle("active", state.waytoagiMode === "today");
  if (waytoagi7dBtnEl) waytoagi7dBtnEl.classList.toggle("active", state.waytoagiMode === "7d");
  waytoagiUpdatedAtEl.textContent = `更新时间：${fmtTime(waytoagi.generated_at)}`;

  waytoagiMetaEl.innerHTML = `
    <a href="${waytoagi.root_url || "#"}" target="_blank" rel="noopener noreferrer">主页面</a>
    <span>·</span>
    <a href="${waytoagi.history_url || "#"}" target="_blank" rel="noopener noreferrer">历史更新页</a>
    <span>·</span>
    <span>当天(${latestDate || "--"})：${fmtNumber(waytoagi.count_today || updatesToday.length)} 条</span>
    <span>·</span>
    <span>近 7 日：${fmtNumber(waytoagi.count_7d || updates7d.length)} 条</span>
  `;

  waytoagiListEl.innerHTML = "";
  if (waytoagi.has_error) {
    const div = document.createElement("div");
    div.className = "waytoagi-error";
    div.textContent = waytoagi.error || "WaytoAGI 数据加载失败";
    waytoagiListEl.appendChild(div);
    return;
  }

  const updates = state.waytoagiMode === "today" ? updatesToday : updates7d;
  if (!updates.length) {
    const div = document.createElement("div");
    div.className = "waytoagi-empty";
    div.textContent = state.waytoagiMode === "today"
      ? "当天没有更新，可切换到近7日查看。"
      : (waytoagi.warning || "近 7 日没有更新");
    waytoagiListEl.appendChild(div);
    return;
  }

  updates.forEach((u) => {
    const row = document.createElement("a");
    row.className = "waytoagi-item";
    row.href = u.url || "#";
    row.target = "_blank";
    row.rel = "noopener noreferrer";
    row.innerHTML = `<span class="d">${fmtDate(u.date)}</span><span class="t">${u.title}</span>`;
    waytoagiListEl.appendChild(row);
  });
}

async function loadNewsData() {
  const res = await fetch(`./data/latest-24h.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`加载 latest-24h.json 失败: ${res.status}`);
  return res.json();
}

async function loadWaytoagiData() {
  const res = await fetch(`./data/waytoagi-7d.json?t=${Date.now()}`);
  if (!res.ok) throw new Error(`加载 waytoagi-7d.json 失败: ${res.status}`);
  return res.json();
}

async function init() {
  loadStarredFromStorage();
  updateStarCount();
  
  const [newsResult, waytoagiResult] = await Promise.allSettled([loadNewsData(), loadWaytoagiData()]);

  if (newsResult.status === "fulfilled") {
    const payload = newsResult.value;
    state.itemsAi = payload.items_ai || payload.items || [];
    state.itemsAllRaw = payload.items_all_raw || payload.items_all || [];
    state.itemsAll = payload.items_all || payload.items || [];
    state.statsAi = payload.site_stats || [];
    state.totalAi = payload.total_items || state.itemsAi.length;
    state.totalRaw = payload.total_items_raw || state.itemsAllRaw.length;
    state.totalAllMode = payload.total_items_all_mode || state.itemsAll.length;
    state.generatedAt = payload.generated_at;

    setStats(payload);
    renderModeSwitch();
    renderSiteFilters();
    renderHotTopics(payload.hot_topics || [], payload.hot_cross_site || []);
    renderList();
    updatedAtEl.textContent = `更新时间：${fmtTime(state.generatedAt)}`;
  } else {
    updatedAtEl.textContent = "新闻数据加载失败";
    newsListEl.innerHTML = `<div class="empty">${newsResult.reason.message}</div>`;
  }

  if (waytoagiResult.status === "fulfilled") {
    state.waytoagiData = waytoagiResult.value;
    renderWaytoagi(state.waytoagiData);
  } else {
    waytoagiUpdatedAtEl.textContent = "加载失败";
    waytoagiListEl.innerHTML = `<div class="waytoagi-error">${waytoagiResult.reason.message}</div>`;
  }
}

searchInputEl.addEventListener("input", (e) => {
  state.query = e.target.value;
  renderList();
});

siteSelectEl.addEventListener("change", (e) => {
  state.siteFilter = e.target.value;
  renderSiteFilters();
  renderList();
});

modeAiBtnEl.addEventListener("click", () => {
  state.mode = "ai";
  renderModeSwitch();
  renderSiteFilters();
  renderList();
});

modeAllBtnEl.addEventListener("click", () => {
  state.mode = "all";
  renderModeSwitch();
  renderSiteFilters();
  renderList();
});

if (allDedupeToggleEl) {
  allDedupeToggleEl.addEventListener("change", (e) => {
    state.allDedup = Boolean(e.target.checked);
    renderModeSwitch();
    renderSiteFilters();
    renderList();
  });
}

if (waytoagiTodayBtnEl) {
  waytoagiTodayBtnEl.addEventListener("click", () => {
    state.waytoagiMode = "today";
    if (state.waytoagiData) renderWaytoagi(state.waytoagiData);
  });
}

if (waytoagi7dBtnEl) {
  waytoagi7dBtnEl.addEventListener("click", () => {
    state.waytoagiMode = "7d";
    if (state.waytoagiData) renderWaytoagi(state.waytoagiData);
  });
}

if (starFilterBtnEl) {
  starFilterBtnEl.addEventListener("click", () => {
    state.showStarredOnly = !state.showStarredOnly;
    updateStarCount();
    renderList();
    if (state.showStarredOnly) {
      const exportBtn = document.createElement("button");
      exportBtn.className = "star-action-btn";
      exportBtn.textContent = "导出星标JSON";
      exportBtn.onclick = exportStarredData;
      
      const clearBtn = document.createElement("button");
      clearBtn.className = "star-action-btn";
      clearBtn.textContent = "清除所有星标";
      clearBtn.onclick = () => {
        if (confirm("确定要清除所有星标吗？")) {
          state.starredUrls.clear();
          saveStarredToStorage();
          updateStarCount();
          renderList();
        }
      };
      
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "star-actions";
      actionsDiv.appendChild(exportBtn);
      actionsDiv.appendChild(clearBtn);
      
      const existingActions = document.querySelector(".star-actions");
      if (existingActions) existingActions.remove();
      
      const listHead = document.querySelector(".list-head");
      if (listHead) {
        listHead.appendChild(actionsDiv);
      }
    } else {
      const existingActions = document.querySelector(".star-actions");
      if (existingActions) existingActions.remove();
    }
  });
}

init();
