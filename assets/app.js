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
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
  const countBy = (arr) => { const m = new Map(); arr.forEach((k) => { if (k) m.set(k, (m.get(k) || 0) + 1); }); return [...m].sort((a, b) => b[1] - a[1]); };
  function armButton(b, label, armedLabel, action) {
    b.addEventListener("click", () => {
      if (!b.classList.contains("arm")) {
        b.classList.add("arm"); b.textContent = armedLabel;
        setTimeout(() => { b.classList.remove("arm"); b.textContent = label; }, 3000);
        return;
      }
      b.classList.remove("arm"); b.textContent = label; action();
    });
  }

  const SUBJECT_ORDER = ["회로이론", "전기자기학", "전기기기", "전력공학", "제어공학", "전기설비", "회사상식", "한국사"];
  const subjRank = (s) => { const i = SUBJECT_ORDER.indexOf(s); return i < 0 ? 99 : i; };
  const COMPANIES = ["한국수력원자력", "한국전력공사", "한전KPS", "한국전기안전공사", "한국남동발전", "한국남부발전", "한국동서발전", "한국서부발전", "한국중부발전", "한국가스공사", "한국전력기술", "기타"];
  const PERIODS = ["2026 하반기", "2026 상반기", "2025 하반기", "2025 상반기", "그 이전"];
  const TRACKS = ["전기", "기계", "화학", "원자력", "사무", "기타"];
  const SUBS = ["회로이론", "전기자기학", "전기기기", "전력공학", "제어공학", "전기설비", "회사상식", "한국사", "NCS 의사소통", "NCS 수리", "NCS 문제해결", "기타"];
  const maskName = (n) => !n ? "" : n.length === 2 ? n[0] + "*" : n[0] + "*".repeat(n.length - 2) + n[n.length - 1];
  const BAD_WORDS = /(시발|씨발|씨빨|ㅅㅂ|ㅆㅂ|병신|ㅂㅅ|좆|존나|졸라|개새|새끼|미친놈|미친년|꺼져|fuck|shit|bitch|섹스)/i;
  // 서버(DB)와 같은 규칙으로 미리 알려주기. 실제 차단은 서버가 해요.
  function checkRecallText(topic, note) {
    const body = (topic + " " + note).toLowerCase();
    if (topic.length < 4) return "출제 주제를 조금 더 구체적으로 (4자 이상) 적어주세요.";
    if (!/[가-힣A-Za-z].*[가-힣A-Za-z]/.test(topic) || /^[ㄱ-ㅎㅏ-ㅣ0-9\s\p{P}\p{S}]+$/u.test(topic)) return "자음·모음이나 숫자만으로는 올릴 수 없어요. 어떤 주제였는지 글로 적어주세요.";
    if (/(https?:\/\/|www\.|\.com|\.co\.kr|\.net|오픈채팅|카톡|open\.kakao)/.test(body)) return "링크나 연락처는 올릴 수 없어요.";
    if (/([^0-9])\1{3,}/.test(body)) return "같은 글자를 계속 반복할 수 없어요.";
    if (BAD_WORDS.test(body)) return "바르지 않은 표현이 있어요.";
    return "";
  }
  const KINDS = ["계산", "개념·정의", "그래프·회로 해석", "법규·상식", "기타"];
  const STATUS = { pending: ["검사 대기 · 나만 보여요", ""], accepted: ["반영됨", "accepted"], used: ["문제로 만들어짐", "used"], rejected: ["반영 안 됨", "rejected"] };

  let sb = null;
  try {
    if (window.supabase && CFG.supabaseUrl) sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
  } catch (e) { sb = null; }

  const S = {
    problems: [], loaded: false,
    answers: store.get("answers", {}) || {},
    user: null, nickname: "", realName: "", isAdmin: false,
    exams: null, mock: null, timer: null
  };

  /* ================= tabs ================= */
  const TABS = ["solve", "mock", "trend", "recall", "rank"];
  function showTab(name) {
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
    TABS.forEach((n) => { $("p-" + n).hidden = n !== name; });
    store.set("tab", name);
    if (name === "trend") renderTrend();
    if (name === "recall") renderRecall();
    if (name === "rank") renderRank();
    if (name === "mock" && !S.mock) renderMockHome();
  }
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));

  /* ================= account ================= */
  const toEmail = (id) => id.trim().toLowerCase() + "@" + (CFG.idDomain || "id.bokgi.kr");
  let authMode = "login";

  function renderAccount() {
    const box = $("account");
    if (!sb) { box.replaceChildren(); return; }
    if (S.user) {
      const out = el("button", { type: "button", class: "btn-ghost" }, "로그아웃");
      out.addEventListener("click", async () => { await sb.auth.signOut(); });
      box.replaceChildren(el("span", {}, el("b", {}, myName() || "회원"), "님", S.isAdmin ? " · 운영자" : ""), out);
    } else {
      const b = el("button", { type: "button", class: "btn-line sm" }, "로그인 / 회원가입");
      b.addEventListener("click", () => openAuth("login"));
      box.replaceChildren(b);
    }
  }

  function openAuth(mode) {
    setAuthMode(mode);
    $("authbox").hidden = false;
    $("a-id").focus();
    $("authbox").scrollIntoView({ block: "nearest" });
  }
  function setAuthMode(mode) {
    authMode = mode;
    $("mode-login").setAttribute("aria-pressed", String(mode === "login"));
    $("mode-signup").setAttribute("aria-pressed", String(mode === "signup"));
    ["f-nick", "f-pw2", "f-real", "f-invite", "a-real-note"].forEach((id) => { $(id).hidden = mode !== "signup"; });
    $("a-submit").textContent = mode === "signup" ? "가입하기" : "로그인";
    $("a-pw").setAttribute("autocomplete", mode === "signup" ? "new-password" : "current-password");
    setMsg("");
  }
  function setMsg(t, err) { const m = $("a-msg"); m.textContent = t; m.className = "msg" + (err ? " err" : ""); }
  $("mode-login").addEventListener("click", () => setAuthMode("login"));
  $("mode-signup").addEventListener("click", () => setAuthMode("signup"));
  $("auth-close").addEventListener("click", () => { $("authbox").hidden = true; });

  $("authform").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!sb) return setMsg("지금은 로그인을 쓸 수 없어요. 잠시 후 다시 시도해 주세요.", true);
    const id = $("a-id").value.trim().toLowerCase(), pw = $("a-pw").value;
    if (!/^[a-z0-9_]{3,16}$/.test(id)) return setMsg("아이디는 영문 소문자, 숫자, _ 로 3~16자예요.", true);
    if (pw.length < 6) return setMsg("비밀번호는 6자 이상이에요.", true);
    const btn = $("a-submit"); btn.disabled = true;
    try {
      if (authMode === "login") {
        setMsg("로그인하는 중…");
        const { error } = await sb.auth.signInWithPassword({ email: toEmail(id), password: pw });
        if (error) return setMsg("아이디나 비밀번호가 맞지 않아요.", true);
      } else {
        const nick = $("a-nick").value.trim(), real = $("a-real").value.trim(), invite = $("a-invite").value.trim().toUpperCase();
        if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return setMsg("비밀번호는 영문과 숫자를 섞어 8자 이상으로 만들어주세요.", true);
        if (pw.toLowerCase().includes(id)) return setMsg("비밀번호에 아이디를 넣지 마세요.", true);
        if (pw !== $("a-pw2").value) return setMsg("비밀번호 확인이 달라요.", true);
        if (!/^[가-힣]{2,5}$/.test(real)) return setMsg("실명은 한글 2~5자로 적어주세요.", true);
        if (!/^[가-힣A-Za-z0-9_ ]{1,12}$/.test(nick)) return setMsg("닉네임은 한글·영문·숫자로 1~12자예요.", true);
        if (BAD_WORDS.test(nick) || /(미친|운영자|관리자|admin)/i.test(nick)) return setMsg("쓸 수 없는 닉네임이에요.", true);
        if (!invite) return setMsg("가입 코드를 적어주세요. 단톡방 공지에 있어요.", true);
        setMsg("확인하는 중…");
        const inv = await sb.rpc("check_invite", { code: invite });
        if (inv.error) return setMsg("확인하지 못했어요. 잠시 후 다시 시도해 주세요.", true);
        if (!inv.data) return setMsg("가입 코드가 맞지 않아요.", true);
        const ok = await sb.rpc("username_available", { u: id });
        if (ok.error) return setMsg("확인하지 못했어요. 잠시 후 다시 시도해 주세요.", true);
        if (!ok.data) return setMsg("이미 쓰고 있는 아이디예요.", true);
        const dup = await sb.from("profiles").select("id").eq("nickname", nick).limit(1);
        if (dup.data && dup.data.length) return setMsg("이미 쓰고 있는 닉네임이에요.", true);
        const { data, error } = await sb.auth.signUp({ email: toEmail(id), password: pw, options: { data: { username: id, nickname: nick, real_name: real, invite } } });
        if (error) {
          const m = String(error.message || "");
          if (/registered|exists/i.test(m)) return setMsg("이미 쓰고 있는 아이디예요.", true);
          if (/database error/i.test(m)) return setMsg("닉네임이 이미 있거나 쓸 수 없는 글자가 있어요.", true);
          if (/password/i.test(m)) return setMsg("비밀번호가 너무 쉬워요. 다른 비밀번호를 써주세요.", true);
          return setMsg("가입하지 못했어요. 잠시 후 다시 시도해 주세요.", true);
        }
        if (!data.session) return setMsg("가입은 됐어요. 로그인 탭에서 로그인해 주세요.");
      }
      $("a-pw").value = ""; $("a-pw2").value = "";
      $("authbox").hidden = true;
    } finally { btn.disabled = false; }
  });

  async function onSession(session) {
    const prev = S.user && S.user.id;
    S.user = session ? session.user : null;
    S.nickname = ""; S.realName = ""; S.isAdmin = false;
    if (S.user) {
      const { data } = await sb.rpc("my_profile");
      const me = data && data[0];
      if (me) { S.nickname = me.nickname; S.realName = me.real_name || ""; S.isAdmin = !!me.is_admin; }
    }
    $("realbox").hidden = !(S.user && !S.realName);
    renderAccount();
    if ((S.user && S.user.id) !== prev) {
      if (S.user) await syncProgress();
      if (!$("p-recall").hidden) renderRecall();
      if (!$("p-rank").hidden) renderRank();
    }
  }

  function myName() { return S.nickname ? S.nickname + (S.realName ? "(" + maskName(S.realName) + ")" : "") : ""; }

  $("realform").addEventListener("submit", async (e) => {
    e.preventDefault();
    const n = $("r-real").value.trim(), msg = $("r-real-msg");
    if (!/^[가-힣]{2,5}$/.test(n)) { msg.textContent = "실명은 한글 2~5자로 적어주세요."; msg.className = "msg err"; return; }
    const { error } = await sb.rpc("set_real_name", { n });
    if (error) { msg.textContent = "등록하지 못했어요. 잠시 후 다시 시도해 주세요."; msg.className = "msg err"; return; }
    S.realName = n; $("realbox").hidden = true; renderAccount();
    if (!$("p-recall").hidden) renderRecall();
  });

  /* ================= solving history ================= */
  function savePick(id, pick) {
    S.answers[id] = pick; store.set("answers", S.answers);
    if (sb && S.user) sb.from("progress").upsert({ user_id: S.user.id, problem_id: id, pick, updated_at: new Date().toISOString() }).then(() => {});
  }
  function clearPick(id) {
    delete S.answers[id]; store.set("answers", S.answers);
    if (sb && S.user) sb.from("progress").delete().eq("problem_id", id).then(() => {});
  }
  async function syncProgress() {
    const { data, error } = await sb.from("progress").select("problem_id,pick");
    if (error || !data) return;
    const server = {};
    data.forEach((r) => { server[r.problem_id] = r.pick; });
    const up = Object.keys(S.answers).filter((id) => server[id] === undefined)
      .map((id) => ({ user_id: S.user.id, problem_id: id, pick: S.answers[id] }));
    Object.assign(S.answers, server);
    store.set("answers", S.answers);
    if (up.length) await sb.from("progress").upsert(up);
    renderProblems();
  }

  /* ================= problems ================= */
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
    buildFilters();
    renderProblems();
  }

  function buildFilters() {
    const subCount = new Map(), coCount = new Map();
    S.problems.forEach((p) => {
      subCount.set(p.subject, (subCount.get(p.subject) || 0) + 1);
      coCount.set(p.company || "공통", (coCount.get(p.company || "공통") || 0) + 1);
    });
    const subs = [...subCount.keys()].sort((a, b) => subjRank(a) - subjRank(b));
    const cos = [...coCount.keys()].sort((a, b) => (a === "공통") - (b === "공통") || a.localeCompare(b));
    const s = store.get("sub", ""), c = store.get("co", "");
    $("f-sub").replaceChildren(el("option", { value: "" }, "전체 과목 (" + S.problems.length + ")"), ...subs.map((x) => el("option", { value: x }, x + " (" + subCount.get(x) + ")")));
    $("f-co").replaceChildren(el("option", { value: "" }, "전체 기업"), ...cos.map((x) => el("option", { value: x }, (x === "공통" ? "공통 (기업 무관)" : x + " 복기") + " (" + coCount.get(x) + ")")));
    $("f-sub").value = subCount.has(s) ? s : "";
    $("f-co").value = coCount.has(c) ? c : "";
    $("f-view").value = store.get("view", "all");
  }

  function visibleProblems() {
    const sub = $("f-sub").value, co = $("f-co").value, view = $("f-view").value;
    return S.problems.filter((p) => {
      if (sub && p.subject !== sub) return false;
      if (co && (p.company || "공통") !== co) return false;
      const a = S.answers[p.id];
      if (view === "todo") return a === undefined;
      if (view === "wrong") return a !== undefined && a !== p.answer;
      return true;
    });
  }

  function stars(n) { const k = Math.max(1, Math.min(3, Number(n) || 1)); return "●".repeat(k) + "○".repeat(3 - k); }

  // mode: solve(바로 채점) · exam(고르기만) · review(채점 결과 보기)
  function card(p, label, mode, chosen, onPick) {
    const reveal = mode === "review" || (mode === "solve" && chosen !== undefined);
    const choices = (p.choices || []).map((c, j) => {
      let cls = "choice";
      if (reveal) { if (j === p.answer) cls += " correct"; else if (j === chosen) cls += " wrong"; }
      else if (mode === "exam" && j === chosen) cls += " picked";
      const b = el("button", { type: "button", class: cls, "aria-label": (j + 1) + "번 " + c, "aria-pressed": String(j === chosen) },
        el("span", { class: "bub" }, String(j + 1)), el("span", {}, c));
      if (reveal) b.disabled = true; else b.addEventListener("click", () => onPick(j));
      return el("li", {}, b);
    });
    const foot = [];
    if (mode === "solve" && reveal) {
      const again = el("button", { type: "button", class: "btn-ghost" }, "다시 풀기");
      again.addEventListener("click", () => { clearPick(p.id); renderProblems(); });
      foot.push(again);
    }
    if (reveal && CFG.reportUrl) foot.push(el("a", { class: "btn-ghost", href: CFG.reportUrl, target: "_blank", rel: "noopener" }, p.id + " 오류 신고"));
    return el("article", { class: "q" },
      el("div", { class: "meta" },
        el("span", { class: "qid" }, label),
        el("span", {}, [p.company && p.company !== "공통" && !p.basis ? p.company : null, p.subject, p.topic].filter(Boolean).join(" · ")),
        el("span", { class: "lv", title: "난이도" }, stars(p.level)),
        p.basis ? el("span", { class: "badge src" }, p.basis + (p.by ? " · " + p.by : "") + (p.source === "AI 자동 생성" ? " · 자동" : "")) : null,
        p.reviewed ? el("span", { class: "badge ok" }, "검수 완료") : el("span", { class: "badge" }, "검수 전")),
      el("p", { class: "qtext" }, p.q || ""),
      el("ol", { class: "choices" }, choices),
      reveal ? el("div", { class: "explain" },
        chosen === undefined ? el("span", { class: "no" }, "안 푼 문제예요. 정답은 " + (p.answer + 1) + "번. ")
          : chosen === p.answer ? el("span", { class: "ok" }, "정답이에요. ") : el("span", { class: "no" }, "오답이에요. 정답은 " + (p.answer + 1) + "번. "),
        p.explain || "") : null,
      foot.length ? el("div", { class: "qfoot" }, foot) : null
    );
  }

  function renderProblems() {
    const done = S.problems.filter((p) => S.answers[p.id] !== undefined);
    const right = done.filter((p) => S.answers[p.id] === p.answer).length;
    $("score").textContent = S.problems.length
      ? "푼 문제 " + done.length + " / " + S.problems.length + " · 정답 " + right + " · 오답 " + (done.length - right) + (S.user ? " · 기록 동기화 중" : " · 로그인하면 기록이 폰·PC에서 이어져요")
      : "";
    if (!S.loaded) return;
    const list = visibleProblems();
    if (!list.length) {
      const view = $("f-view").value;
      const msg = !S.problems.length ? "아직 올라온 문제가 없어요."
        : view === "wrong" ? "틀린 문제가 없어요. 잘하고 있어요!"
        : view === "todo" ? "이 조건의 문제는 다 풀었어요. '전체 문제'로 바꿔서 해설을 다시 보거나 다른 과목을 골라보세요."
        : "이 조건에 맞는 문제가 없어요.";
      $("qlist").replaceChildren(el("div", { class: "empty" }, msg));
      return;
    }
    $("qlist").replaceChildren(...list.map((p) => card(p, p.id, "solve", S.answers[p.id], (j) => { savePick(p.id, j); renderProblems(); })));
  }
  ["f-sub", "f-co", "f-view"].forEach((id) => $(id).addEventListener("change", () => {
    store.set({ "f-sub": "sub", "f-co": "co", "f-view": "view" }[id], $(id).value); renderProblems();
  }));
  armButton($("reset"), "풀이 기록 지우기", "한 번 더 누르면 지워져요", () => {
    S.answers = {}; store.set("answers", S.answers);
    if (sb && S.user) sb.from("progress").delete().eq("user_id", S.user.id).then(() => {});
    renderProblems();
  });

  /* ================= recall data (seed + live) ================= */
  let recallPromise = null;
  function loadRecalls(force) {
    if (recallPromise && !force) return recallPromise;
    recallPromise = (async () => {
      const out = { live: [], seed: [], interviews: [], liveFailed: false };
      try {
        const r = await fetch("data/recalls.json", { cache: "no-cache" });
        if (r.ok) {
          const j = await r.json();
          out.seed = (j.recalls || []).map((x) => Object.assign({ period: "", track: "전기", level: "", note: "", writer: "" }, x));
          out.interviews = j.interviews || [];
        }
      } catch (e) {}
      if (sb) {
        const { data, error } = await sb.from("recalls_public")
          .select("writer,company,period,track,subject,topic,kind,level,note,status,created_at")
          .order("created_at", { ascending: false }).limit(500);
        if (error) out.liveFailed = true; else out.live = data || [];
      }
      out.all = out.live.concat(out.seed);
      return out;
    })();
    return recallPromise;
  }

  /* ================= trend ================= */
  let trendCompany = "";
  async function renderTrend() {
    const box = $("trend");
    const d = await loadRecalls();
    const all = d.all;
    if (!all.length) { box.replaceChildren(el("div", { class: "empty" }, "아직 올라온 복기가 없어요. 시험 보고 왔다면 '복기 남기기'에서 첫 복기를 남겨주세요.")); return; }
    const cos = countBy(all.map((r) => r.company)).map(([k]) => k);
    const sel = el("select", { "aria-label": "기업 선택" }, el("option", { value: "" }, "전체 기업"), cos.map((c) => el("option", { value: c }, c)));
    sel.value = cos.includes(trendCompany) ? trendCompany : "";
    sel.addEventListener("change", () => { trendCompany = sel.value; renderTrend(); });
    const rs = all.filter((r) => !sel.value || r.company === sel.value);
    const bySub = countBy(rs.map((r) => r.subject));
    const max = bySub.length ? bySub[0][1] : 1;
    const ivs = d.interviews.filter((q) => !sel.value || q.company === sel.value);
    box.replaceChildren(
      d.liveFailed ? el("div", { class: "empty" }, "새로 올라온 복기를 불러오지 못해서 정리된 자료만 보여드려요.") : null,
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
      el("div", { class: "chips" }, countBy(rs.map((r) => r.topic)).slice(0, 30).map(([k, n]) => el("span", { class: "chip" }, k, el("b", {}, String(n))))),
      el("h2", {}, "올라온 복기"),
      el("div", { class: "list" }, rs.slice(0, 30).map((r) => el("article", { class: "rec" },
        el("div", { class: "meta" }, [r.company, r.period, r.track, r.subject, r.kind, r.level ? "난이도 " + r.level : "", r.writer ? "by " + r.writer : ""].filter(Boolean).join(" · ")),
        el("div", { class: "topic" }, r.topic),
        r.note ? el("div", { class: "note" }, r.note) : null))),
      rs.length > 30 ? el("p", { class: "muted" }, "최근 30건만 보여요. 위에서 기업을 고르면 그 기업 복기만 볼 수 있어요.") : null,
      ivs.length ? el("h2", {}, "면접 기출") : null,
      ivs.length ? el("div", { class: "panel" }, el("ul", { class: "rules" }, ivs.map((q) => el("li", {}, el("b", {}, q.company), " · ", q.q)))) : null
    );
  }

  /* ================= recall submit ================= */
  function opts(sel, items) { sel.replaceChildren(...items.map((v) => el("option", { value: v }, v))); return sel; }
  async function renderRecall() {
    const box = $("recallbox");
    const rules = el("ul", { class: "rules" },
      el("li", {}, el("b", {}, "문제 원문은 그대로 옮기지 마세요."), " 어떤 주제가 어떤 식으로 나왔는지만 적어주세요. 시험 문제는 출제기관 저작물이고, 유출 금지 서약을 받는 시험도 있어요."),
      el("li", {}, "올린 복기는 검사(운영자 확인 또는 매일 오전 9시 자동 검사)를 통과하면 닉네임(김*희)과 함께 공개돼요. 그 전에는 나만 보여요."),
      el("li", {}, "욕설, 링크, 같은 글자 반복, 자음만 쓴 글, 이미 올린 주제는 올라가지 않아요. 하루 10건까지예요."),
      el("li", {}, "점수: 공개된 복기 1점, 그 복기로 문제가 만들어지면 2점 추가"));
    if (!sb) { box.replaceChildren(el("div", { class: "empty" }, "지금은 복기를 받을 수 없어요. 잠시 후 다시 열어주세요.")); return; }
    if (!S.user) {
      const a = el("button", { type: "button", class: "btn" }, "로그인하고 복기 남기기");
      a.addEventListener("click", () => openAuth("login"));
      const b = el("button", { type: "button", class: "btn-line" }, "회원가입");
      b.addEventListener("click", () => openAuth("signup"));
      box.replaceChildren(el("div", { class: "panel" },
        el("h2", {}, "시험 보고 왔다면 복기를 남겨주세요"),
        el("p", {}, "남겨준 주제는 검사를 거쳐 출제 경향에 쌓이고, 같은 유형의 새 문제로 만들어져요. 많이 남길수록 랭킹이 올라가요."),
        rules, el("div", { class: "actions" }, a, b)));
      return;
    }
    if (!S.realName) {
      box.replaceChildren(el("div", { class: "panel" }, el("h2", {}, "실명을 먼저 등록해 주세요"),
        el("p", {}, "복기를 올리려면 실명이 필요해요. 화면 위쪽의 '실명을 등록해 주세요' 칸에 적어주세요."), rules));
      return;
    }
    const f = {
      co: opts(el("select", { id: "r-co" }), COMPANIES), period: opts(el("select", { id: "r-period" }), PERIODS),
      track: opts(el("select", { id: "r-track" }), TRACKS),
      sub: opts(el("select", { id: "r-sub" }), SUBS),
      topic: el("input", { id: "r-topic", maxlength: "80", placeholder: "예: RL 직렬회로 유효전력 계산 (원문 말고 주제만)", autocomplete: "off" }),
      kind: opts(el("select", { id: "r-kind" }), KINDS),
      level: opts(el("select", { id: "r-level" }), ["1", "2", "3", "4", "5"]),
      note: el("textarea", { id: "r-note", maxlength: "1000", placeholder: "어떤 식으로 물었는지, 함정 보기, 시간 배분 팁 등" })
    };
    f.level.value = "3";
    const last = store.get("lastRecall", {});
    if (last.co) f.co.value = last.co; if (last.period) f.period.value = last.period; if (last.track) f.track.value = last.track;
    const msg = el("span", { class: "msg", role: "status" });
    const submit = el("button", { class: "btn", type: "submit" }, "복기 올리기");
    const lab = (t, input, full) => el("div", { class: "field" + (full ? " full" : "") }, el("label", { for: input.id }, t), input);
    const form = el("form", { class: "panel grid2", novalidate: "" },
      el("div", { class: "rule" }, el("b", {}, myName()), " 이름으로 올라가요. 문제 원문 말고 주제와 유형만 적어주세요."),
      lab("기업", f.co), lab("시험 시기", f.period), lab("직렬", f.track), lab("과목", f.sub),
      lab("출제 주제", f.topic, true), lab("유형", f.kind), lab("체감 난이도 (1 쉬움 ~ 5 어려움)", f.level), lab("메모 (선택)", f.note, true),
      el("div", { class: "actions" }, submit, msg));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const subject = f.sub.value.trim(), topic = f.topic.value.trim();
      msg.className = "msg";
      const bad = checkRecallText(topic, f.note.value.trim());
      if (bad) { msg.textContent = bad; msg.className = "msg err"; return; }
      submit.disabled = true; msg.textContent = "올리는 중…";
      const row = { company: f.co.value, period: f.period.value, track: f.track.value, subject, topic, kind: f.kind.value, level: Number(f.level.value), note: f.note.value.trim() || null };
      const { error } = await sb.from("recalls").insert(row);
      submit.disabled = false;
      if (error) { msg.textContent = /[가-힣]/.test(error.message || "") ? error.message : "올리지 못했어요. 잠시 후 다시 눌러주세요."; msg.className = "msg err"; return; }
      store.set("lastRecall", { co: row.company, period: row.period, track: row.track });
      f.topic.value = ""; f.note.value = "";
      msg.textContent = "올렸어요! 검사를 통과하면 공개되고 +1점, 문제로 만들어지면 +2점 더.";
      loadRecalls(true); loadMine(mine);
    });
    const mine = el("div", { class: "list" }, el("div", { class: "empty" }, "내 복기를 불러오는 중이에요…"));
    const admin = S.isAdmin ? el("div", { class: "list" }, el("div", { class: "empty" }, "검토할 복기를 불러오는 중이에요…")) : null;
    box.replaceChildren(
      ...(S.isAdmin ? [el("h2", {}, "운영자 검토 (공개 전 복기)"), admin] : []),
      el("div", { class: "panel" }, el("h2", {}, "복기 남기기"), rules), form, el("h2", {}, "내가 올린 복기"), mine);
    loadMine(mine);
    if (admin) loadAdmin(admin);
  }

  async function loadAdmin(box) {
    const { data, error } = await sb.rpc("admin_pending");
    if (error) { box.replaceChildren(el("div", { class: "empty" }, "검토 목록을 불러오지 못했어요.")); return; }
    if (!data.length) { box.replaceChildren(el("div", { class: "empty" }, "검토할 복기가 없어요. 새로 올라오면 여기에 떠요.")); return; }
    box.replaceChildren(...data.map((r) => {
      const act = (status) => async () => {
        const { error: err } = await sb.rpc("admin_set_status", { rid: r.id, new_status: status });
        if (!err) { loadRecalls(true); loadAdmin(box); }
      };
      const ok = el("button", { type: "button", class: "btn-line sm" }, "승인 (공개)");
      ok.addEventListener("click", act("accepted"));
      const no = el("button", { type: "button", class: "btn-ghost" }, "반려");
      armButton(no, "반려", "한 번 더 누르면 반려돼요", act("rejected"));
      return el("article", { class: "rec" },
        el("div", { class: "meta" }, [r.real_name ? r.real_name + " (" + r.nickname + ")" : r.nickname, r.company, r.period, r.track, r.subject, r.kind, r.level ? "난이도 " + r.level : ""].filter(Boolean).join(" · ")),
        el("div", { class: "topic" }, r.topic),
        r.note ? el("div", { class: "note" }, r.note) : null,
        el("div", { class: "actions" }, ok, no));
    }));
  }

  async function loadMine(box) {
    const { data, error } = await sb.from("recalls").select("id,company,period,subject,topic,status,problem_id,result,created_at")
      .eq("user_id", S.user.id).order("created_at", { ascending: false }).limit(100);
    if (error) { box.replaceChildren(el("div", { class: "empty" }, "내 복기를 불러오지 못했어요.")); return; }
    if (!data.length) { box.replaceChildren(el("div", { class: "empty" }, "아직 올린 복기가 없어요. 위에서 첫 복기를 남겨보세요.")); return; }
    box.replaceChildren(...data.map((r) => {
      const st = STATUS[r.status] || STATUS.pending;
      const kids = [
        el("div", { class: "meta" }, [r.company, r.period, r.subject].filter(Boolean).join(" · "), el("span", { class: "pill " + st[1] }, st[0] + (r.problem_id ? " · " + r.problem_id : ""))),
        el("div", { class: "topic" }, r.topic),
        r.result && r.status !== "used" ? el("div", { class: "note" }, r.result) : null
      ];
      if (r.status === "pending") {
        const d = el("button", { type: "button", class: "btn-ghost" }, "삭제");
        armButton(d, "삭제", "한 번 더 누르면 삭제돼요", async () => {
          const { error: err } = await sb.from("recalls").delete().eq("id", r.id);
          if (!err) { loadRecalls(true); loadMine(box); }
        });
        kids.push(d);
      }
      return el("article", { class: "rec" }, kids);
    }));
  }

  /* ================= ranking ================= */
  async function renderRank() {
    const box = $("rank");
    const how = el("p", { class: "muted" }, "공개된 복기 1점 + 그 복기로 문제가 만들어지면 2점 추가. 자동 검사와 문제 반영은 매일 오전 9시예요.");
    if (!sb) { box.replaceChildren(el("div", { class: "empty" }, "지금은 랭킹을 불러올 수 없어요.")); return; }
    const { data, error } = await sb.rpc("get_ranking", { lim: 50 });
    if (error) { box.replaceChildren(el("div", { class: "empty" }, "랭킹을 불러오지 못했어요. 잠시 후 다시 열어주세요.")); return; }
    if (!data.length) {
      const b = el("button", { type: "button", class: "btn" }, "첫 복기 남기러 가기");
      b.addEventListener("click", () => showTab("recall"));
      box.replaceChildren(el("div", { class: "panel" }, el("h2", {}, "아직 랭킹이 비어 있어요"), el("p", {}, "지금 복기를 남기면 바로 1등이에요."), how, el("div", { class: "actions" }, b)));
      return;
    }
    const medal = ["1", "2", "3"];
    box.replaceChildren(
      el("h2", {}, "복기 랭킹"), how,
      el("div", { class: "tablewrap" }, el("table", { class: "rank" },
        el("thead", {}, el("tr", {}, el("th", {}, "순위"), el("th", {}, "이름"), el("th", { class: "num" }, "복기"), el("th", { class: "num" }, "문제화"), el("th", { class: "num" }, "점수"))),
        el("tbody", {}, data.map((r, i) => el("tr", { class: r.name === myName() ? "me" : "" },
          el("td", {}, el("span", { class: "medal" }, i < 3 ? medal[i] + "위" : String(i + 1))),
          el("td", {}, r.name + (r.name === myName() ? " · 나" : "")),
          el("td", { class: "num" }, String(r.recalls)), el("td", { class: "num" }, String(r.used)), el("td", { class: "num" }, String(r.points)))))))
    );
  }

  /* ================= mock exams ================= */
  async function loadExams() {
    if (S.exams) return S.exams;
    try { const r = await fetch("data/exams.json", { cache: "no-cache" }); S.exams = await r.json(); }
    catch (e) { S.exams = { exams: [] }; }
    return S.exams;
  }

  async function companyWeights(company) {
    const d = await loadRecalls();
    const subs = countBy(d.all.filter((r) => r.company === company && r.subject !== "한국사").map((r) => r.subject));
    const total = subs.reduce((a, [, n]) => a + n, 0);
    return subs.map(([s, n]) => [s, n / total]);
  }

  async function buildExam(exam) {
    const used = new Set(), sections = [];
    const weights = await companyWeights(exam.company);
    for (const sec of exam.sections) {
      const only = sec.subjects;
      const pool = S.problems.filter((p) => only ? only.includes(p.subject) : p.subject !== "한국사");
      const pick = [];
      const take = (arr, limit) => {
        for (const p of arr) {
          if (pick.length >= sec.count || (limit !== undefined && limit <= 0)) break;
          if (used.has(p.id)) continue;
          used.add(p.id); pick.push(p);
          if (limit !== undefined) limit--;
        }
      };
      take(shuffle(pool.filter((p) => p.company === exam.company)));   // 1) 이 기업 복기 기반
      if (!only) for (const [s, w] of weights) {                        // 2) 이 기업 출제 비중대로
        const need = Math.round(sec.count * w) - pick.filter((p) => p.subject === s).length;
        if (need > 0) take(shuffle(pool.filter((p) => p.subject === s)), need);
      }
      take(shuffle(pool));                                              // 3) 남은 자리 채우기
      pick.sort((a, b) => subjRank(a.subject) - subjRank(b.subject));
      sections.push({ name: sec.name, want: sec.count, items: pick });
    }
    return sections;
  }

  async function renderMockHome() {
    const box = $("mock");
    if (!S.loaded) { box.replaceChildren(el("div", { class: "empty" }, "문제를 불러오는 중이에요…")); return; }
    const ex = await loadExams();
    const best = store.get("mockBest", {});
    const cards = ex.exams.map((e) => {
      const total = e.sections.reduce((a, s) => a + s.count, 0);
      const b = el("button", { type: "button", class: "btn" }, "시작하기");
      b.addEventListener("click", () => startMock(e));
      const mine = S.problems.filter((p) => p.company === e.company).length;
      return el("article", { class: "mockcard" },
        el("h3", {}, e.company),
        el("div", { class: "sec" }, e.sections.map((s) => s.name + " " + s.count).join(" · ") + " · 총 " + total + "문항"),
        el("div", { class: "muted" }, "이 기업 복기 기반 문제 " + mine + "개 우선 출제, 나머지는 이 기업 출제 비중대로 채워요."),
        e.note ? el("div", { class: "muted" }, e.note) : null,
        best[e.company] ? el("div", { class: "best" }, "최고 " + best[e.company].score + " / " + best[e.company].total) : null,
        b);
    });
    box.replaceChildren(
      el("div", { class: "panel" }, el("h2", {}, "회사별 실전 모의고사"),
        el("p", {}, "실제 시험처럼 끝까지 풀고 한 번에 채점해요. 시간을 재고, 과목별 점수와 틀린 문제 해설을 보여줘요."),
        el("p", { class: "muted" }, ex.basis || "")),
      el("div", { class: "mockgrid" }, cards));
  }

  async function startMock(exam) {
    const sections = await buildExam(exam);
    S.mock = { exam, sections, picks: {}, start: Date.now(), done: false };
    clearInterval(S.timer);
    S.timer = setInterval(updateTimer, 1000);
    renderMock();
    window.scrollTo({ top: 0 });
  }
  const fmt = (ms) => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
  function updateTimer() { const t = document.getElementById("mock-timer"); if (t && S.mock && !S.mock.done) t.textContent = fmt(Date.now() - S.mock.start); }
  const mockItems = () => S.mock.sections.flatMap((s) => s.items);

  function renderMock() {
    const m = S.mock, box = $("mock");
    const items = mockItems();
    const answered = items.filter((p) => m.picks[p.id] !== undefined).length;
    const submit = el("button", { type: "button", class: "btn" }, "답안 제출");
    armButton(submit, "답안 제출", answered < items.length ? "안 푼 문제 " + (items.length - answered) + "개, 그래도 제출?" : "한 번 더 누르면 채점해요", finishMock);
    const quit = el("button", { type: "button", class: "btn-ghost" }, "그만두기");
    armButton(quit, "그만두기", "한 번 더 누르면 나가요", () => { clearInterval(S.timer); S.mock = null; renderMockHome(); });
    let n = 0;
    const body = [];
    m.sections.forEach((s) => {
      body.push(el("div", { class: "sechead" }, s.name + " " + s.items.length + "문항" + (s.items.length < s.want ? " (실제 " + s.want + "문항 중 준비된 문제만 출제)" : "")));
      s.items.forEach((p) => {
        n++;
        body.push(card(p, String(n).padStart(2, "0"), "exam", m.picks[p.id], (j) => { m.picks[p.id] = j; renderMock(); }));
      });
    });
    box.replaceChildren(
      el("div", { class: "examhead" },
        el("strong", {}, m.exam.company + " 모의고사"),
        el("span", { class: "timer", id: "mock-timer" }, fmt(Date.now() - m.start)),
        el("span", { class: "prog" }, answered + " / " + items.length + " 표기"),
        el("span", { class: "actions" }, quit, submit)),
      el("div", { class: "list" }, body),
      el("div", { class: "toolbar end" }, submit.cloneNode(true)));
    // 아래쪽 제출 버튼도 같은 동작
    const bottom = box.querySelector(".toolbar.end .btn");
    armButton(bottom, "답안 제출", answered < items.length ? "안 푼 문제 " + (items.length - answered) + "개, 그래도 제출?" : "한 번 더 누르면 채점해요", finishMock);
  }

  function finishMock() {
    const m = S.mock; m.done = true; clearInterval(S.timer);
    const elapsed = Date.now() - m.start;
    const items = mockItems();
    const right = items.filter((p) => m.picks[p.id] === p.answer).length;
    items.forEach((p) => { if (m.picks[p.id] !== undefined) savePick(p.id, m.picks[p.id]); });
    const best = store.get("mockBest", {});
    const prev = best[m.exam.company];
    if (!prev || right / items.length > prev.score / prev.total) { best[m.exam.company] = { score: right, total: items.length }; store.set("mockBest", best); }
    const bySub = new Map();
    items.forEach((p) => { const v = bySub.get(p.subject) || [0, 0]; v[1]++; if (m.picks[p.id] === p.answer) v[0]++; bySub.set(p.subject, v); });
    const back = el("button", { type: "button", class: "btn-line" }, "모의고사 목록");
    back.addEventListener("click", () => { S.mock = null; renderMockHome(); window.scrollTo({ top: 0 }); });
    const again = el("button", { type: "button", class: "btn" }, "같은 회사 다시 풀기");
    again.addEventListener("click", () => startMock(m.exam));
    let n = 0;
    const numbered = items.map((p) => ({ p, no: ++n }));
    const wrong = numbered.filter(({ p }) => m.picks[p.id] !== p.answer);
    $("mock").replaceChildren(
      el("div", { class: "result" },
        el("h2", {}, m.exam.company + " 모의고사 결과"),
        el("div", { class: "big" }, right + " / " + items.length),
        el("p", {}, "정답률 " + Math.round(right / Math.max(1, items.length) * 100) + "% · 걸린 시간 " + fmt(elapsed)),
        el("div", { class: "bars" }, [...bySub].sort((a, b) => subjRank(a[0]) - subjRank(b[0])).map(([s, [r, t]]) => {
          const fill = el("span", { class: "fill" }); fill.style.width = (r / t * 100) + "%";
          return el("div", { class: "bar" }, el("span", { class: "lab" }, s), el("span", { class: "track" }, fill), el("span", { class: "n" }, r + "/" + t));
        })),
        el("div", { class: "actions" }, again, back)),
      el("h2", {}, wrong.length ? "틀리거나 안 푼 문제 " + wrong.length + "개" : "전부 맞혔어요!"),
      el("div", { class: "list" }, wrong.map(({ p, no }) => card(p, String(no).padStart(2, "0") + " · " + p.id, "review", m.picks[p.id]))));
    window.scrollTo({ top: 0 });
  }

  /* ================= start ================= */
  renderAccount();
  const hash = (location.hash || "").slice(1);
  showTab(TABS.includes(hash) ? hash : (store.get("tab", "solve") || "solve"));
  loadProblems().then(() => { if (!$("p-mock").hidden && !S.mock) renderMockHome(); });
  if (sb) {
    sb.auth.getSession().then(({ data }) => onSession(data.session));
    sb.auth.onAuthStateChange((_ev, session) => { setTimeout(() => onSession(session), 0); });
  }
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
