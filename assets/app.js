(function () {
  "use strict";
  const CFG = window.BOKGI_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === "class") e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    for (const c of kids.flat()) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : String(c));
    }
    return e;
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem("bokgi:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("bokgi:" + k, JSON.stringify(v)); } catch (e) {} }
  };

  const S = {
    problems: [],
    loaded: false,
    answers: store.get("answers", {}) || {},
    mock: null,      // 모의고사 문제 id 목록
    mockAns: {}      // 모의고사 중 고른 답 (기록과 따로)
  };

  /* ---------- tabs ---------- */
  const TABS = ["solve", "trend", "recall"];
  function showTab(name) {
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
    TABS.forEach((n) => { $("p-" + n).hidden = n !== name; });
    store.set("tab", name);
    if (name === "trend") loadTrend();
  }
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));

  /* ---------- problems ---------- */
  async function loadProblems() {
    try {
      const r = await fetch("data/problems.json", { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      S.problems = Array.isArray(j.problems) ? j.problems : [];
      if (j.updated) $("updated").textContent = "문제 업데이트: " + j.updated + " · 총 " + S.problems.length + "문제";
    } catch (e) {
      S.problems = [];
      $("qlist").replaceChildren(el("div", { class: "empty" }, "문제를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요."));
    }
    S.loaded = true;
    buildSubjectFilter();
    renderProblems();
  }

  function buildSubjectFilter() {
    const sel = $("f-sub");
    const counts = new Map();
    S.problems.forEach((p) => counts.set(p.subject, (counts.get(p.subject) || 0) + 1));
    const saved = store.get("sub", "");
    sel.replaceChildren(
      el("option", { value: "" }, "전체 과목 (" + S.problems.length + ")"),
      ...[...counts].map(([s, n]) => el("option", { value: s }, s + " (" + n + ")"))
    );
    sel.value = counts.has(saved) ? saved : "";
    $("f-view").value = store.get("view", "all");
  }

  function pickOf(id) { return S.mock ? S.mockAns[id] : S.answers[id]; }

  function visibleProblems() {
    if (S.mock) return S.mock.map((id) => S.problems.find((p) => p.id === id)).filter(Boolean);
    const sub = $("f-sub").value, view = $("f-view").value;
    return S.problems.filter((p) => {
      if (sub && p.subject !== sub) return false;
      const a = S.answers[p.id];
      if (view === "todo") return a === undefined;
      if (view === "wrong") return a !== undefined && a !== p.answer;
      return true;
    });
  }

  function renderScore() {
    if (S.mock) {
      const ps = visibleProblems();
      const done = ps.filter((p) => S.mockAns[p.id] !== undefined);
      const right = done.filter((p) => S.mockAns[p.id] === p.answer).length;
      $("mocktext").textContent = done.length < ps.length
        ? "모의고사 " + done.length + " / " + ps.length + " 풀었어요"
        : "모의고사 끝! " + ps.length + "문제 중 " + right + "문제 맞혔어요";
      $("score").textContent = "";
      return;
    }
    const done = S.problems.filter((p) => S.answers[p.id] !== undefined);
    const right = done.filter((p) => S.answers[p.id] === p.answer).length;
    const wrong = done.length - right;
    $("score").textContent = S.problems.length
      ? "푼 문제 " + done.length + " / " + S.problems.length + " · 정답 " + right + " · 오답 " + wrong
      : "";
  }

  function stars(n) { const k = Math.max(1, Math.min(3, Number(n) || 1)); return "●".repeat(k) + "○".repeat(3 - k); }

  function card(p, i) {
    const chosen = pickOf(p.id), isDone = chosen !== undefined;
    const choices = (p.choices || []).map((c, j) => {
      let cls = "choice";
      if (isDone) { if (j === p.answer) cls += " correct"; else if (j === chosen) cls += " wrong"; }
      const b = el("button", { class: cls, type: "button", "aria-label": (j + 1) + "번 " + c },
        el("span", { class: "bub" }, String(j + 1)), el("span", {}, c));
      if (isDone) b.disabled = true;
      else b.addEventListener("click", () => choose(p, j));
      return el("li", {}, b);
    });
    const foot = [];
    if (isDone && !S.mock) {
      const again = el("button", { type: "button", class: "btn-ghost" }, "다시 풀기");
      again.addEventListener("click", () => { delete S.answers[p.id]; store.set("answers", S.answers); renderProblems(); });
      foot.push(again);
    }
    if (isDone && CFG.reportUrl) {
      foot.push(el("a", { class: "btn-ghost", href: CFG.reportUrl, target: "_blank", rel: "noopener" }, p.id + " 오류 신고"));
    }
    return el("article", { class: "q" },
      el("div", { class: "meta" },
        el("span", { class: "qid" }, S.mock ? "Q" + String(i + 1).padStart(2, "0") : p.id),
        el("span", {}, [p.company && p.company !== "공통" ? p.company : null, p.subject, p.topic].filter(Boolean).join(" · ")),
        el("span", { class: "lv", title: "난이도" }, stars(p.level)),
        p.source === "AI 자동 생성" ? el("span", { class: "badge src", title: p.basis || "" }, "AI 자동 생성") : null,
        p.reviewed ? el("span", { class: "badge ok" }, "검수 완료") : el("span", { class: "badge" }, "검수 전")),
      el("p", { class: "qtext" }, p.q || ""),
      el("ol", { class: "choices" }, choices),
      isDone ? el("div", { class: "explain" },
        chosen === p.answer ? el("span", { class: "ok" }, "정답이에요. ") : el("span", { class: "no" }, "오답이에요. 정답은 " + (p.answer + 1) + "번. "),
        p.explain || "") : null,
      foot.length ? el("div", { class: "qfoot" }, foot) : null
    );
  }

  function choose(p, j) {
    if (S.mock) S.mockAns[p.id] = j;
    S.answers[p.id] = j;
    store.set("answers", S.answers);
    renderProblems();
  }

  function renderProblems() {
    $("mockbar").hidden = !S.mock;
    $("f-sub").disabled = $("f-view").disabled = $("mock").disabled = !!S.mock;
    renderScore();
    if (!S.loaded) return;
    const list = visibleProblems();
    if (!list.length) {
      const view = $("f-view").value;
      const msg = !S.problems.length ? "아직 올라온 문제가 없어요."
        : view === "wrong" ? "틀린 문제가 없어요. 잘하고 있어요!"
        : view === "todo" ? "이 과목은 다 풀었어요. '전체 문제'로 바꿔서 해설을 다시 보거나 다른 과목을 골라보세요."
        : "이 조건에 맞는 문제가 없어요.";
      $("qlist").replaceChildren(el("div", { class: "empty" }, msg));
      return;
    }
    $("qlist").replaceChildren(...list.map(card));
  }

  $("f-sub").addEventListener("change", () => { store.set("sub", $("f-sub").value); renderProblems(); });
  $("f-view").addEventListener("change", () => { store.set("view", $("f-view").value); renderProblems(); });
  $("mock").addEventListener("click", () => {
    const sub = $("f-sub").value;
    const pool = S.problems.filter((p) => !sub || p.subject === sub).map((p) => p.id);
    for (let i = pool.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [pool[i], pool[k]] = [pool[k], pool[i]]; }
    S.mock = pool.slice(0, 10); S.mockAns = {};
    renderProblems();
    window.scrollTo({ top: 0 });
  });
  $("mockend").addEventListener("click", () => { S.mock = null; S.mockAns = {}; renderProblems(); });
  $("reset").addEventListener("click", (e) => {
    const b = e.currentTarget;
    if (!b.classList.contains("arm")) {
      b.classList.add("arm"); b.textContent = "한 번 더 누르면 지워져요";
      setTimeout(() => { b.classList.remove("arm"); b.textContent = "이 기기의 풀이 기록 지우기"; }, 3000);
      return;
    }
    S.answers = {}; store.set("answers", S.answers);
    b.classList.remove("arm"); b.textContent = "이 기기의 풀이 기록 지우기";
    renderProblems();
  });

  /* ---------- recall form ---------- */
  function renderForm() {
    const box = $("formbox");
    if (CFG.formUrl) {
      box.replaceChildren(el("a", { class: "btn", href: CFG.formUrl, target: "_blank", rel: "noopener" }, "복기 남기러 가기"),
        el("p", { class: "muted" }, "구글폼이 새 창으로 열려요. 로그인 없이 2분이면 끝나요."));
    } else {
      box.replaceChildren(el("p", { class: "muted" }, "복기 제출 창구를 준비하고 있어요. 곧 열릴 예정이에요."));
    }
  }

  /* ---------- trend (Google Sheet CSV) ---------- */
  function parseCSV(text) {
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (ch !== "\r") cur += ch;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  const COLS = { time: ["타임스탬프", "timestamp"], company: ["기업"], period: ["시기"], track: ["직렬"], subject: ["과목"], topic: ["주제"], kind: ["유형"], level: ["난이도"], note: ["메모"] };
  function toRecords(rows) {
    if (!rows.length) return [];
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const idx = {};
    for (const key in COLS) idx[key] = head.findIndex((h) => COLS[key].some((w) => h.includes(w)));
    return rows.slice(1).map((r) => {
      const o = {};
      for (const key in idx) o[key] = idx[key] >= 0 ? (r[idx[key]] || "").trim() : "";
      return o;
    }).filter((o) => o.topic || o.subject);
  }

  let trendState = { loaded: false, records: [], company: "" };
  async function loadTrend() {
    if (trendState.loaded) return;
    const box = $("trend");
    if (!CFG.sheetCsvUrl) {
      box.replaceChildren(el("div", { class: "empty" }, "아직 연결된 복기 데이터가 없어요. 복기가 모이기 시작하면 과목별 출제 빈도와 자주 나온 주제가 여기에 자동으로 정리돼요."));
      trendState.loaded = true;
      return;
    }
    try {
      const r = await fetch(CFG.sheetCsvUrl, { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      trendState.records = toRecords(parseCSV(await r.text())).reverse();
      trendState.loaded = true;
      renderTrend();
    } catch (e) {
      box.replaceChildren(el("div", { class: "empty" }, "복기 데이터를 불러오지 못했어요. 잠시 후 다시 열어주세요."));
    }
  }

  function countBy(arr) {
    const m = new Map();
    arr.forEach((k) => { if (k) m.set(k, (m.get(k) || 0) + 1); });
    return [...m].sort((a, b) => b[1] - a[1]);
  }

  function renderTrend() {
    const all = trendState.records;
    const box = $("trend");
    if (!all.length) {
      box.replaceChildren(el("div", { class: "empty" }, "아직 올라온 복기가 없어요. 시험 보고 왔다면 '복기 남기기'에서 첫 복기를 남겨주세요."));
      return;
    }
    const cos = countBy(all.map((r) => r.company)).map(([k]) => k);
    const sel = el("select", { "aria-label": "기업 선택" }, el("option", { value: "" }, "전체 기업"), cos.map((c) => el("option", { value: c }, c)));
    sel.value = cos.includes(trendState.company) ? trendState.company : "";
    sel.addEventListener("change", () => { trendState.company = sel.value; renderTrend(); });

    const rs = all.filter((r) => !sel.value || r.company === sel.value);
    const bySub = countBy(rs.map((r) => r.subject));
    const max = bySub.length ? bySub[0][1] : 1;
    const byTopic = countBy(rs.map((r) => r.topic)).slice(0, 30);

    box.replaceChildren(
      el("div", { class: "toolbar" }, sel),
      el("div", { class: "stats" },
        el("span", {}, el("b", {}, String(rs.length)), " 건의 복기"),
        el("span", {}, el("b", {}, String(bySub.length)), " 개 과목")),
      el("h2", {}, "과목별 출제 빈도"),
      el("div", { class: "bars" }, bySub.map(([k, n]) => {
        const fill = el("span", { class: "fill" }); fill.style.width = (n / max * 100) + "%";
        return el("div", { class: "bar" }, el("span", { class: "lab" }, k), el("span", { class: "track" }, fill), el("span", { class: "n" }, String(n)));
      })),
      el("h2", {}, "자주 나온 주제"),
      el("div", { class: "chips" }, byTopic.map(([k, n]) => el("span", { class: "chip" }, k, el("b", {}, String(n))))),
      el("h2", {}, "최근 올라온 복기"),
      el("div", { class: "list" }, rs.slice(0, 20).map((r) => el("article", { class: "rec" },
        el("div", { class: "meta" }, [r.company, r.period, r.track, r.subject, r.kind, r.level ? "난이도 " + r.level : ""].filter(Boolean).join(" · ")),
        el("div", { class: "topic" }, r.topic),
        r.note ? el("div", { class: "note" }, r.note) : null)))
    );
  }

  /* ---------- start ---------- */
  renderForm();
  const hash = (location.hash || "").slice(1);
  showTab(TABS.includes(hash) ? hash : (store.get("tab", "solve") || "solve"));
  loadProblems();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
