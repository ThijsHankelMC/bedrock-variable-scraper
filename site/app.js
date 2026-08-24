"use strict";

const UPSTREAM_REPO = "Mojang/bedrock-samples";
const DATA_DIR = "data";

const state = {
    index: null,
    snapshot: null,
    entry: null,
};

const els = {
    stats: document.getElementById("stats"),
    versionSelect: document.getElementById("version-select"),
    search: document.getElementById("search"),
    sortSelect: document.getElementById("sort-select"),
    entitySelect: document.getElementById("entity-select"),
    groupSelect: document.getElementById("group-select"),
    kindInputs: [...document.querySelectorAll(".kinds input[data-kind]")],
    newOnly: document.getElementById("new-only"),
    diff: document.getElementById("diff"),
    diffSummary: document.getElementById("diff-summary"),
    addedList: document.getElementById("added-list"),
    removedList: document.getElementById("removed-list"),
    results: document.getElementById("results"),
    updatedAt: document.getElementById("updated-at"),
    repoLink: document.getElementById("repo-link"),
};

function buildParams(focusId) {
    const p = new URLSearchParams();
    if (state.snapshot) p.set("v", state.snapshot.version);
    const q = els.search.value.trim();
    if (q) p.set("q", q);
    if (els.entitySelect.value) p.set("entity", els.entitySelect.value);
    if (els.sortSelect.value !== "name") p.set("sort", els.sortSelect.value);
    if (els.groupSelect.value !== "none") p.set("group", els.groupSelect.value);
    const checked = els.kindInputs.filter((i) => i.checked).map((i) => i.dataset.kind);
    if (checked.length !== els.kindInputs.length) p.set("kinds", checked.join(","));
    if (els.newOnly.checked) p.set("new", "1");
    if (focusId) p.set("id", focusId);
    return p;
}

function syncUrl() {
    const qs = buildParams().toString();
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function fmt(n) {
    return n.toLocaleString("en-US");
}

async function fetchJson(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
    return res.json();
}

function blobUrl(ref, path, line) {
    const base = `https://github.com/${UPSTREAM_REPO}/blob/${encodeURIComponent(ref)}/${path.split("/").map(encodeURIComponent).join("/")}`;
    return line ? `${base}#L${line}` : base;
}

function renderStats() {
    const s = state.snapshot;
    const e = state.entry;
    const delta =
        e && (e.added.length || e.removed.length) ? `<div class="delta"><span class="added">+${e.added.length}</span> · <span class="removed">-${e.removed.length}</span> vs previous</div>` : "";
    els.stats.innerHTML = `
    <div class="stat-card">
      <div class="value">${fmt(s.identifierCount)}</div>
      <div class="label">Identifiers</div>
      ${delta}
    </div>
    <div class="stat-card">
      <div class="value">${fmt(s.totalOccurrences)}</div>
      <div class="label">Occurrences</div>
    </div>
    <div class="stat-card">
      <div class="value variable">${fmt(s.counts.variable)}</div>
      <div class="label">variable.*</div>
    </div>
    <div class="stat-card">
      <div class="value context">${fmt(s.counts.context)}</div>
      <div class="label">context.*</div>
    </div>
    <div class="stat-card">
      <div class="value temp">${fmt(s.counts.temp)}</div>
      <div class="label">temp.*</div>
    </div>`;
}

function renderDiff() {
    const e = state.entry;
    if (!e || (!e.added.length && !e.removed.length)) {
        els.diff.hidden = true;
        return;
    }
    els.diff.hidden = false;
    els.diffSummary.textContent = `Changes in ${e.version}: ${e.added.length} added, ${e.removed.length} removed`;
    els.addedList.innerHTML = e.added.map((n) => `<span class="name-chip added">${escapeHtml(n)}</span>`).join("") || '<span class="muted">None</span>';
    els.removedList.innerHTML = e.removed.map((n) => `<span class="name-chip removed">${escapeHtml(n)}</span>`).join("") || '<span class="muted">None</span>';
}

function activeKinds() {
    const set = new Set();
    for (const input of els.kindInputs) if (input.checked) set.add(input.dataset.kind);
    return set;
}

function filteredIdentifiers() {
    const query = els.search.value.trim().toLowerCase();
    const kinds = activeKinds();
    const entity = els.entitySelect.value;
    const addedSet = state.entry ? new Set(state.entry.added) : new Set();
    const newOnly = els.newOnly.checked;

    let list = state.snapshot.identifiers.filter((id) => {
        if (!kinds.has(id.kind)) return false;
        if (query && !id.name.toLowerCase().includes(query)) return false;
        if (entity && !id.entities.includes(entity)) return false;
        if (newOnly && !addedSet.has(id.name)) return false;
        return true;
    });

    const sort = els.sortSelect.value;
    list = list.slice().sort((a, b) => {
        switch (sort) {
            case "count-desc":
                return b.totalCount - a.totalCount || a.name.localeCompare(b.name);
            case "count-asc":
                return a.totalCount - b.totalCount || a.name.localeCompare(b.name);
            case "files-desc":
                return b.fileCount - a.fileCount || a.name.localeCompare(b.name);
            default:
                return a.name.localeCompare(b.name);
        }
    });
    return list;
}

function groupsFor(list, groupBy) {
    const map = new Map();
    const add = (key, id) => {
        let arr = map.get(key);
        if (!arr) {
            arr = [];
            map.set(key, arr);
        }
        arr.push(id);
    };
    if (groupBy === "kind") {
        for (const id of list) add(id.kind, id);
    } else if (groupBy === "entity") {
        const only = els.entitySelect.value;
        for (const id of list)
            for (const ent of id.entities) {
                if (only && ent !== only) continue;
                add(ent, id);
            }
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function usageHtml(id) {
    const ref = state.snapshot.ref || state.snapshot.version;
    return id.files
        .map((f) => {
            const lines = f.lines.map((ln) => `<a class="line-link" href="${blobUrl(ref, f.path, ln)}" target="_blank" rel="noopener">L${ln}</a>`).join("");
            return `<div class="usage">
        <span class="entity-tag">${escapeHtml(f.entity)}</span>
        <a class="path" href="${blobUrl(ref, f.path)}" target="_blank" rel="noopener">${escapeHtml(f.path)}</a>
        <span class="count">×${f.count}</span>
        <span class="lines">${lines}</span>
      </div>`;
        })
        .join("");
}

function buildCard(id, addedSet) {
    const details = document.createElement("details");
    details.className = "id-card";
    details.dataset.name = id.name;
    details.id = `id-${id.name}`;
    const isNew = addedSet.has(id.name);
    const dotIdx = id.name.indexOf(".");
    const kind = id.name.slice(0, dotIdx);
    const member = id.name.slice(dotIdx + 1);
    const shorthand = id.shorthandCount ? `<span class="badge" title="Occurrences written with shorthand (v./c./t.)">${fmt(id.shorthandCount)}× shorthand</span>` : "";
    details.innerHTML = `
    <summary>
      <span class="id-name"><span class="kind kind-${kind}">${kind}.</span>${escapeHtml(member)}</span>
      ${isNew ? '<span class="badge new">new</span>' : ""}
      <span class="spacer"></span>
      <span class="meta">
        <span class="badge">${fmt(id.totalCount)}× uses</span>
        <span class="badge">${fmt(id.fileCount)} files</span>
        <span class="badge">${fmt(id.entities.length)} entities</span>
        ${shorthand}
        <button type="button" class="copy-link" data-name="${escapeHtml(id.name)}" title="Copy link to this identifier" aria-label="Copy link to this identifier">🔗</button>
      </span>
    </summary>
    <div class="usages">${usageHtml(id)}</div>`;
    return details;
}

function onResultsClick(e) {
    const btn = e.target.closest(".copy-link");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const url = `${location.origin}${location.pathname}?${buildParams(btn.dataset.name).toString()}`;
    const done = () => {
        const prev = btn.textContent;
        btn.textContent = "✓";
        setTimeout(() => (btn.textContent = prev), 1200);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done);
}

function render() {
    renderStats();
    renderDiff();
    renderResults();
}

function populateEntities(preferred) {
    const set = new Set();
    for (const id of state.snapshot.identifiers) for (const e of id.entities) set.add(e);
    const entities = [...set].sort((a, b) => a.localeCompare(b));
    const current = preferred !== undefined ? preferred : els.entitySelect.value;
    els.entitySelect.innerHTML = '<option value="">All entities</option>' + entities.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");
    els.entitySelect.value = current && entities.includes(current) ? current : "";
}

function renderResults() {
    const addedSet = state.entry ? new Set(state.entry.added) : new Set();
    const list = filteredIdentifiers();
    syncUrl();

    if (!list.length) {
        els.results.innerHTML = '<div class="empty">No identifiers match your filters.</div>';
        return;
    }

    const groupBy = els.groupSelect.value;
    const frag = document.createDocumentFragment();

    if (groupBy === "none") {
        for (const id of list) frag.appendChild(buildCard(id, addedSet));
    } else {
        for (const [name, ids] of groupsFor(list, groupBy)) {
            const section = document.createElement("details");
            section.className = "group-section";
            section.open = true;
            const nameClass = groupBy === "kind" ? `kind-${name}` : "";
            section.innerHTML = `
        <summary class="group-header">
          <span class="group-name ${nameClass}">${escapeHtml(name)}</span>
          <span class="badge">${fmt(ids.length)}</span>
        </summary>`;
            const body = document.createElement("div");
            body.className = "group-body";
            for (const id of ids) body.appendChild(buildCard(id, addedSet));
            section.appendChild(body);
            frag.appendChild(section);
        }
    }
    els.results.replaceChildren(frag);
}

function openIdentifier(name) {
    const el = els.results.querySelector(`[data-name="${name.replace(/"/g, '\\"')}"]`);
    if (!el) return false;
    const group = el.closest("details.group-section");
    if (group) group.open = true;
    el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("highlight");
    setTimeout(() => el.classList.remove("highlight"), 1600);
    return true;
}

async function loadVersion(version, entityParam) {
    state.snapshot = await fetchJson(`${DATA_DIR}/versions/${version}.json`);
    state.entry = state.index.versions.find((v) => v.version === version) || null;
    els.repoLink.href = `https://github.com/${UPSTREAM_REPO}/tree/${encodeURIComponent(state.snapshot.ref || version)}`;
    populateEntities(entityParam);
    render();
}

function applyParams(p) {
    if (p.get("q")) els.search.value = p.get("q");
    if (p.get("sort")) els.sortSelect.value = p.get("sort");
    if (p.get("group")) els.groupSelect.value = p.get("group");
    if (p.get("new") === "1") els.newOnly.checked = true;
    const kinds = p.get("kinds");
    if (kinds) {
        const set = new Set(kinds.split(","));
        for (const input of els.kindInputs) input.checked = set.has(input.dataset.kind);
    }
}

function readParams() {
    return new URLSearchParams(location.search);
}

function wireEvents() {
    els.versionSelect.addEventListener("change", (e) => loadVersion(e.target.value));
    els.search.addEventListener("input", renderResults);
    els.sortSelect.addEventListener("change", renderResults);
    els.entitySelect.addEventListener("change", renderResults);
    els.groupSelect.addEventListener("change", renderResults);
    els.newOnly.addEventListener("change", renderResults);
    for (const input of els.kindInputs) input.addEventListener("change", renderResults);
    els.results.addEventListener("click", onResultsClick);
}

function populateVersions() {
    els.versionSelect.innerHTML = state.index.versions
        .map((v) => {
            const label = `${v.version}${v.version === state.index.latest ? " (latest)" : ""}`;
            return `<option value="${escapeHtml(v.version)}">${escapeHtml(label)}</option>`;
        })
        .join("");
}

async function init() {
    try {
        state.index = await fetchJson(`${DATA_DIR}/versions.json`);
    } catch {
        els.results.innerHTML = '<div class="empty">No data generated yet. Run the scraper or wait for the next scheduled build.</div>';
        return;
    }
    if (!state.index.versions.length) {
        els.results.innerHTML = '<div class="empty">No versions found in the dataset.</div>';
        return;
    }
    populateVersions();
    wireEvents();
    els.updatedAt.textContent = `Dataset updated ${new Date(state.index.updatedAt).toLocaleString()}`;

    const p = readParams();
    applyParams(p);
    const wanted = p.get("v");
    const version = state.index.versions.some((v) => v.version === wanted) ? wanted : state.index.latest;
    els.versionSelect.value = version;
    await loadVersion(version, p.get("entity") || "");

    const focus = p.get("id");
    if (focus && !openIdentifier(focus)) {
        els.search.value = focus;
        renderResults();
        openIdentifier(focus);
    }
}

init();
