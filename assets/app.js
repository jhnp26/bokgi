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
  const put = (box, ...kids) => box.replaceChildren(...kids.filter((k) => k != null && k !== false));
  const countBy = (arr) => { const m = new Map(); arr.forEach((k) => { if (k) m.set(k, (m.get(k) || 0) + 1); }); return [...m].sort((a, b) => b[1] - a[1]); };
  function armButton(b, label, armedLabel, action) {
    b.addEventListener("click", () => {
      if (!b.classList.contains("arm")) {
        b.classList.add("arm"); b.textContent = armedLabel;
        b._armT = setTimeout(() => { b.classList.remove("arm"); b.textContent = label; }, 3000);
        return;
      }
      clearTimeout(b._armT); b.classList.remove("arm"); b.textContent = label; action();
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
  // 복기 입력 도우미: 주제 글자를 보고 과목·유형을 짐작해요 (회원이 직접 고르면 그대로 둬요)
  const nrm = (t) => (t || "").toLowerCase().replace(/\s+/g, "");
  function buildGuess(recs) {
    const exact = new Map(), tok = new Map();
    const add = (subject, topic) => {
      if (!subject || !topic || !SUBS.includes(subject)) return;
      exact.set(nrm(topic), subject);
      for (const w of String(topic).split(/[\s·,()/\[\]]+/)) {
        const t = w.replace(/(에서|으로|의|을|를|이|가|은|는|에|과|와|로)$/, "");
        if (t.length < 2 || /^[\d.%]+$/.test(t)) continue;
        const m = tok.get(t) || {}; m[subject] = (m[subject] || 0) + 1; tok.set(t, m);
      }
    };
    S.problems.forEach((p) => { add(p.subject, p.topic); add(p.subject, p.fromTopic); });
    recs.forEach((r) => add(r.subject, r.topic));
    return (text) => {
      const n = nrm(text);
      if (n.length < 2) return "";
      if (exact.has(n)) return exact.get(n);
      const score = {};
      for (const [t, m] of tok) {
        if (!text.includes(t)) continue;
        const tot = Object.values(m).reduce((a, b) => a + b, 0);
        for (const k in m) score[k] = (score[k] || 0) + t.length * m[k] / tot;
      }
      let best = "", bs = 1.5;
      for (const k in score) if (score[k] > bs) { best = k; bs = score[k]; }
      if (best) return best;
      for (const [k, re] of SUBJ_WORDS) if (re.test(text)) return k;
      return "";
    };
  }
  const SUBJ_WORDS = [
    ["제어공학", /근궤적|전달함수|나이퀴스트|보드선도|안정도|라플라스|블록선도|PID|과도응답|정상편차|상태방정식|시퀀스|논리회로/i],
    ["전기설비", /KEC|접지|전선|케이블|배선|누전|분전반|간선|전기설비/i],
    ["전기자기학", /전계|자계|정전용량|유전체|맥스웰|가우스|쿨롱|자속|전위|자성체|전자유도|정전에너지/],
    ["전기기기", /변압기|발전기|전동기|유도기|동기기|직류기|정류기|여자|전기자|슬립/],
    ["전력공학", /송전|배전|단락|코로나|피뢰기|차단기|조상|중성점|전압강하|선로|수력|화력|원자력|보호계전/],
    ["회로이론", /공진|임피던스|테브난|노턴|과도현상|RLC|RL|RC|역률|유효전력|무효전력|키르히호프|브리지|대칭좌표/i],
    ["한국사", /조선|고려|신라|백제|고구려|독립|왕|조약|전쟁/],
    ["회사상식", /인재상|비전|미션|경영|핵심가치|사업|원전|한수원|한전/]
  ];
  function guessKind(t) {
    if (/계산|값|크기|몇|얼마|산출/.test(t)) return "계산";
    if (/그래프|파형|선도|궤적|회로도|보드|나이퀴스트|벡터도/.test(t)) return "그래프·회로 해석";
    if (/사업법|관리법|법규|법령|규정|기술기준|kec|접지|안전|한국사|상식|역사|인물|비전|인재상/i.test(t)) return "법규·상식";
    return t.trim().length >= 4 ? "개념·정의" : "";
  }
  // 출제 경향의 '나도 나왔어요' → 복기 입력칸에 담아두기
  function addToDraft(r) {
    const d = store.get("recallDraft", null) || {};
    d.rows = (d.rows || []).filter((x) => (x.topic || "").trim());
    if (!d.rows.length) {
      if (COMPANIES.includes(r.company)) d.co = r.company;
      if (PERIODS.includes(r.period)) d.period = r.period;
      if (r.session_id) d.sess = String(r.session_id);
    }
    if (!d.rows.some((x) => nrm(x.topic) === nrm(r.topic)))
      d.rows.push({ subject: SUBS.includes(r.subject) ? r.subject : "", kind: KINDS.includes(r.kind) ? r.kind : "", topic: r.topic, note: "", ms: true });
    store.set("recallDraft", d);
    showTab("recall");
  }
  const STATUS = { pending: ["검사 대기 · 나만 보여요", ""], accepted: ["반영됨", "accepted"], used: ["문제로 만들어짐", "used"], rejected: ["반영 안 됨", "rejected"] };

  let sb = null;
  try {
    if (window.supabase && CFG.supabaseUrl) sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
  } catch (e) { sb = null; }

  const S = {
    problems: [], loaded: false,
    answers: store.get("answers", {}) || {},
    rev: store.get("rev", {}) || {},          // 틀린 문제 복습 일정 {id: {step, due}}
    daily: store.get("daily", {}) || {},      // 날짜별 푼 문제 수
    reviewPicks: {}, focus: "", limit: 20,
    stars: store.get("stars", {}) || {},      // 별표한 문제
    cardRev: store.get("cardRev", {}) || {},  // 공식 카드 복습 일정
    stats: new Map(),                          // 문제별 다른 사람들 풀이 통계
    user: null, nickname: "", realName: "", isAdmin: false, verified: false,
    exams: null, mock: null, timer: null
  };

  /* ================= tabs ================= */
  const TABS = ["solve", "mock", "cards", "trend", "recall", "rank"];
  function showTab(name) {
    document.querySelectorAll(".tab").forEach((t) => {
      t.setAttribute("aria-selected", String(t.dataset.tab === name));
      if (t.dataset.tab === name && t.parentElement.scrollWidth > t.parentElement.clientWidth) t.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    TABS.forEach((n) => { $("p-" + n).hidden = n !== name; });
    store.set("tab", name);
    document.body.classList.remove("printing");
    if (name === "cards") renderCards();
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
      const me = el("button", { type: "button", class: "linkish", title: "내 계정 (비밀번호 변경·탈퇴)" }, el("b", {}, myName() || "회원"), "님");
      me.addEventListener("click", () => { $("acctbox").hidden = !$("acctbox").hidden; });
      const extra = [];
      if (S.isAdmin) {
        extra.push(" · 운영자");
        const todo = (S.adminCounts || {});
        const n = (todo.waiting_members || 0) + (todo.pending_recalls || 0) + (todo.open_reports || 0);
        if (n) {
          const go = el("button", { type: "button", class: "linkish", title: "확인 대기 " + (todo.waiting_members || 0) + "명 · 복기 검토 " + (todo.pending_recalls || 0) + "건 · 오류 신고 " + (todo.open_reports || 0) + "건" }, "할 일", el("span", { class: "count" }, String(n)));
          go.addEventListener("click", () => showTab("recall"));
          extra.push(" · ", go);
        }
      } else if (S.realName && !S.verified) extra.push(" · 실명 확인 대기");
      box.replaceChildren(el("span", {}, me, ...extra), out);
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
    ["f-nick", "f-pw2", "f-real", "f-invite", "a-real-note", "a-privacy", "f-agree"].forEach((id) => { $(id).hidden = mode !== "signup"; });
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
        if (!$("a-agree").checked) return setMsg("개인정보 수집·이용에 동의해야 가입할 수 있어요.", true);
        if (!/^[가-힣]{2,5}$/.test(real)) return setMsg("실명은 한글 2~5자로 적어주세요.", true);
        if (!/^[가-힣A-Za-z0-9_ ]{1,12}$/.test(nick)) return setMsg("닉네임은 한글·영문·숫자로 1~12자예요.", true);
        if (BAD_WORDS.test(nick) || /(미친|운영자|관리자|admin)/i.test(nick)) return setMsg("쓸 수 없는 닉네임이에요.", true);
        setMsg("확인하는 중…");
        if (invite) {
          const inv = await sb.rpc("check_invite", { code: invite, rname: real });
          if (inv.error) return setMsg("확인하지 못했어요. 잠시 후 다시 시도해 주세요.", true);
          if (inv.data === "mismatch") return setMsg("이 개인 코드는 다른 실명으로 만들어졌어요. 실명을 정확히 적어주세요.", true);
          if (inv.data !== "personal") return setMsg("개인 코드가 맞지 않아요. 코드가 없으면 칸을 비워두고 가입하세요.", true);
        }
        const ok = await sb.rpc("username_available", { u: id });
        if (ok.error) return setMsg("확인하지 못했어요. 잠시 후 다시 시도해 주세요.", true);
        if (!ok.data) return setMsg("이미 쓰고 있는 아이디예요.", true);
        const dup = await sb.from("profiles").select("id").eq("nickname", nick).limit(1);
        if (dup.data && dup.data.length) return setMsg("이미 쓰고 있는 닉네임이에요.", true);
        const { data, error } = await sb.auth.signUp({ email: toEmail(id), password: pw, options: { data: { username: id, nickname: nick, real_name: real, invite, agree: "yes" } } });
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
    S.nickname = ""; S.realName = ""; S.isAdmin = false; S.verified = false;
    if (S.user) {
      const { data } = await sb.rpc("my_profile");
      const me = data && data[0];
      if (me) { S.nickname = me.nickname; S.realName = me.real_name || ""; S.isAdmin = !!me.is_admin; S.verified = !!me.verified; }
    }
    $("realbox").hidden = !(S.user && !S.realName);
    if (!S.user) $("acctbox").hidden = true;
    S.adminCounts = null;
    renderAccount();
    if (S.isAdmin) refreshAdminCounts();
    if ((S.user && S.user.id) !== prev) {
      if (S.user) await syncProgress();
      if (!$("p-recall").hidden) renderRecall();
      if (!$("p-rank").hidden) renderRank();
    }
  }

  function myName() { return S.nickname ? S.nickname + (S.realName ? "(" + maskName(S.realName) + ")" : "") : ""; }

  $("acct-close").addEventListener("click", () => { $("acctbox").hidden = true; });
  $("pwform").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = $("p-new").value, msg = $("p-msg");
    msg.className = "msg err";
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) { msg.textContent = "영문과 숫자를 섞어 8자 이상으로 만들어주세요."; return; }
    if (pw !== $("p-new2").value) { msg.textContent = "비밀번호 확인이 달라요."; return; }
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) { msg.textContent = /same|different/i.test(error.message || "") ? "지금 비밀번호와 다른 비밀번호를 써주세요." : "바꾸지 못했어요. 다시 로그인한 뒤 시도해 주세요."; return; }
    $("p-new").value = ""; $("p-new2").value = "";
    msg.className = "msg"; msg.textContent = "비밀번호를 바꿨어요.";
  });
  armButton($("leave"), "회원 탈퇴", "정말 탈퇴할까요? 한 번 더 누르면 모두 지워져요", async () => {
    const { error } = await sb.rpc("delete_my_account");
    if (error) { $("leave-msg").textContent = /[가-힣]/.test(error.message || "") ? error.message : "탈퇴하지 못했어요."; return; }
    try { localStorage.removeItem("bokgi:answers"); } catch (err) {}
    await sb.auth.signOut();
    $("acctbox").hidden = true;
  });

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
  const DAY = 864e5, GAPS = [1, 3, 7];
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  function trackStudy(id, pick) {
    const p = (S.allProblems || S.problems).find((x) => x.id === id);
    if (!p) return;
    const r = S.rev[id], now = Date.now();
    if (pick !== p.answer) S.rev[id] = { step: 0, due: now + DAY };                  // 틀리면 내일 다시
    else if (r && now >= r.due - DAY / 2) {                                          // 복습 날에 맞히면 다음 간격으로
      const step = r.step + 1;
      if (step >= GAPS.length) delete S.rev[id]; else S.rev[id] = { step, due: now + GAPS[step] * DAY };
    }
    store.set("rev", S.rev);
    const t = today();
    S.daily[t] = (S.daily[t] || 0) + 1;
    const keys = Object.keys(S.daily).sort();
    while (keys.length > 120) delete S.daily[keys.shift()];
    store.set("daily", S.daily);
  }
  function streak() {
    let n = 0; const d = new Date();
    if (!S.daily[today()]) d.setDate(d.getDate() - 1);                                // 오늘 아직 안 풀었으면 어제부터 셈
    for (;;) {
      const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      if (!S.daily[k]) return n;
      n++; d.setDate(d.getDate() - 1);
    }
  }
  const dueList = () => S.problems.filter((p) => S.rev[p.id] && S.rev[p.id].due <= Date.now());
  function savePick(id, pick) {
    trackStudy(id, pick);
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
      S.allProblems = Array.isArray(j.problems) ? j.problems : [];
      S.hidden = new Map();
      if (sb) {
        // 운영자가 사이트에서 숨긴 문제(오류 신고 등)는 목록·모의고사에서 빼요
        const { data: hid } = await sb.from("hidden_problems").select("problem_id,reason,hidden_at");
        (hid || []).forEach((h) => S.hidden.set(h.problem_id, h));
      }
      S.problems = S.allProblems.filter((p) => !S.hidden.has(p.id));
      if (sb) {
        // 다른 사람들이 고른 보기 분포 (3명 이상 푼 문제만)
        const { data: st } = await sb.rpc("problem_stats");
        S.stats = new Map((st || []).map((r) => [r.problem_id, r]));
      }
      if (j.updated) $("updated").textContent = "문제 업데이트: " + j.updated + " · 총 " + S.problems.length + "문제";
    } catch (e) {
      S.problems = [];
      $("qlist").replaceChildren(el("div", { class: "empty" }, "문제를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요."));
    }
    S.loaded = true;
    buildFilters();
    renderProblems();
    const sl = $("suspectlist"); if (sl) sl.replaceWith(suspectList());   // 운영자 화면이 먼저 열렸으면 통계를 받은 뒤 다시 그림
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
    if (![...$("f-view").options].some((o) => o.value === "review")) $("f-view").append(el("option", { value: "review" }, "오늘 복습할 문제"));
    if (![...$("f-view").options].some((o) => o.value === "star")) $("f-view").append(el("option", { value: "star" }, "별표한 문제"));
    $("f-view").value = store.get("view", "all");
  }

  // 내 약점: 과목별 정답률 + 자주 틀리는 주제
  function weakPanel() {
    const solved = S.problems.filter((p) => S.answers[p.id] !== undefined);
    if (solved.length < 5) return null;
    const by = new Map(), tp = new Map();
    solved.forEach((p) => {
      const ok = S.answers[p.id] === p.answer;
      const a = by.get(p.subject) || [0, 0]; a[0] += ok; a[1]++; by.set(p.subject, a);
      const t = tp.get(p.topic) || [0, 0, p.subject]; t[0] += ok; t[1]++; tp.set(p.topic, t);
    });
    const rows = [...by].sort((x, y) => x[1][0] / x[1][1] - y[1][0] / y[1][1]);
    const worst = [...tp].filter(([, t]) => t[1] - t[0] > 0).sort((x, y) => (x[1][0] / x[1][1]) - (y[1][0] / y[1][1]) || (y[1][1] - x[1][1])).slice(0, 5);
    const go = (sub) => { $("f-sub").value = sub; $("f-view").value = "wrong"; store.set("sub", sub); store.set("view", "wrong"); S.limit = 20; renderProblems(); };
    const d = el("details", { class: "weak" }, el("summary", {}, "내 약점 분석 (푼 문제 " + solved.length + "개 기준)"),
      el("div", { class: "bars" }, rows.map(([k, [ok, n]]) => {
        const pct = Math.round(ok / n * 100);
        const fill = el("span", { class: "fill" }); fill.style.width = pct + "%";
        const lab = el("button", { type: "button", class: "linkish lab", title: k + " 틀린 문제 보기" }, k);
        lab.addEventListener("click", () => go(k));
        return el("div", { class: "bar" }, lab, el("span", { class: "track" }, fill), el("span", { class: "n" }, pct + "% · " + n));
      })),
      worst.length ? el("p", { class: "muted" }, "자주 틀리는 주제: ", ...worst.map(([k, t], i) => {
        const b = el("button", { type: "button", class: "linkish" }, k + " (" + (t[1] - t[0]) + "/" + t[1] + ")");
        b.addEventListener("click", () => go(t[2]));
        return [i ? " · " : "", b];
      }).flat()) : null);
    if (store.get("weakOpen", false)) d.open = true;
    d.addEventListener("toggle", () => store.set("weakOpen", d.open));
    return d;
  }

  const searchText = (p) => p._s || (p._s = nrm([p.id, p.subject, p.topic, p.q, ...(p.choices || []), p.explain || ""].join(" ")));
  function visibleProblems() {
    const sub = $("f-sub").value, co = $("f-co").value, view = $("f-view").value;
    const q = nrm($("f-q") ? $("f-q").value : "");
    if (S.focus) return S.problems.filter((p) => p.id === S.focus);
    const base = (p) => (!sub || p.subject === sub) && (!co || (p.company || "공통") === co) && (!q || searchText(p).includes(q));
    if (view === "review") {
      const due = new Set(dueList().map((p) => p.id));
      return S.problems.filter((p) => (due.has(p.id) || S.reviewPicks[p.id] !== undefined) && base(p));
    }
    return S.problems.filter((p) => {
      if (!base(p)) return false;
      const a = S.answers[p.id];
      if (view === "todo") return a === undefined;
      if (view === "wrong") return a !== undefined && a !== p.answer;
      if (view === "star") return !!S.stars[p.id];
      return true;
    });
  }

  // 다른 사람들 풀이 통계: 5명 이상 푼 문제만 보여줘요
  function statOf(p) {
    const s = S.stats && S.stats.get(p.id);
    if (!s || s.n < 5) return null;
    const picks = s.picks || [];
    const rate = (picks[p.answer] || 0) / s.n;
    let wj = -1, wn = 0;
    picks.forEach((c, j) => { if (j !== p.answer && c > wn) { wn = c; wj = j; } });
    const suspect = s.n >= 8 && rate < 0.3 && wj >= 0 && wn / s.n >= 0.45;   // 한 오답에 몰리면 정답이 틀렸을 수 있어요
    return { n: s.n, rate, wj, wshare: wn / s.n, suspect, healthy: s.n >= 20 && rate >= 0.3 && !suspect, picks };
  }

  function stars(n) { const k = Math.max(1, Math.min(3, Number(n) || 1)); return "●".repeat(k) + "○".repeat(3 - k); }

  // mode: solve(바로 채점) · exam(고르기만) · review(채점 결과 보기)
  function card(p, label, mode, chosen, onPick) {
    const st = statOf(p);
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
    if (mode === "solve") {
      const star = el("button", { type: "button", class: "btn-ghost star", "aria-pressed": String(!!S.stars[p.id]) }, S.stars[p.id] ? "★ 별표" : "☆ 별표");
      star.addEventListener("click", () => {
        if (S.stars[p.id]) delete S.stars[p.id]; else S.stars[p.id] = 1;
        store.set("stars", S.stars);
        star.textContent = S.stars[p.id] ? "★ 별표" : "☆ 별표"; star.setAttribute("aria-pressed", String(!!S.stars[p.id]));
        updateStarCount();
        if ($("f-view").value === "star") renderProblems();
      });
      foot.push(star);
      const sh = el("button", { type: "button", class: "btn-ghost" }, "공유");
      sh.addEventListener("click", async () => {
        const url = location.origin + location.pathname + "#q=" + encodeURIComponent(p.id);
        try {
          if (navigator.share) { await navigator.share({ title: "복기뱅크 " + p.id, text: p.subject + " · " + p.topic, url }); return; }
          await navigator.clipboard.writeText(url); sh.textContent = "링크 복사됨";
        } catch (e) { if (e && e.name !== "AbortError") { sh.textContent = url; } }
      });
      foot.unshift(sh);
    }
    let reportBox = null;
    if (reveal) {
      const rb = el("button", { type: "button", class: "btn-ghost" }, "오류 신고");
      foot.push(rb);
      reportBox = el("div", { class: "reportbox", hidden: "" });
      rb.addEventListener("click", () => {
        if (!S.user) { openAuth("login"); return; }
        if (!reportBox.hidden) { reportBox.hidden = true; return; }
        const why = el("select", { "aria-label": "신고 이유" }, ["정답이 틀림", "해설이 틀림", "문제·보기가 이상함", "기타"].map((v) => el("option", { value: v }, v)));
        const note = el("input", { maxlength: "300", placeholder: "어디가 이상한지 짧게 (선택)", "aria-label": "신고 내용" });
        const send = el("button", { type: "button", class: "btn sm" }, "보내기");
        const msg = el("span", { class: "msg", role: "status" });
        send.addEventListener("click", async () => {
          send.disabled = true;
          const { error } = await sb.from("reports").insert({ problem_id: p.id, reason: why.value, note: note.value.trim() || null });
          send.disabled = false;
          if (error) { msg.textContent = /[가-힣]/.test(error.message || "") ? error.message : "보내지 못했어요. 잠시 후 다시 해주세요."; msg.className = "msg err"; return; }
          reportBox.replaceChildren(el("span", { class: "msg" }, "신고했어요. 운영자가 확인하고 고칠게요. 고마워요!"));
        });
        reportBox.replaceChildren(el("b", {}, p.id), why, note, send, msg);
        reportBox.hidden = false;
      });
    }
    return el("article", { class: "q" },
      el("div", { class: "meta" },
        el("span", { class: "qid" }, label),
        el("span", {}, [p.company && p.company !== "공통" && !p.basis ? p.company : null, p.subject, p.topic].filter(Boolean).join(" · ")),
        el("span", { class: "lv", title: "난이도" }, stars(p.level)),
        p.basis ? el("span", { class: "badge src" }, p.basis + (p.by ? " · " + p.by : "") + (p.source === "AI 자동 생성" ? " · 자동" : "")) : null,
        p.reviewed ? el("span", { class: "badge ok" }, "검수 완료")
          : st && st.healthy ? el("span", { class: "badge ok", title: "많은 사람이 풀었고 정답률이 정상이에요" }, st.n + "명 풀이 · 이상 없음")
          : el("span", { class: "badge" }, "검수 전")),
      el("p", { class: "qtext" }, p.q || ""),
      el("ol", { class: "choices" }, choices),
      reveal ? el("div", { class: "explain" },
        chosen === undefined ? el("span", { class: "no" }, "안 푼 문제예요. 정답은 " + (p.answer + 1) + "번. ")
          : chosen === p.answer ? el("span", { class: "ok" }, "정답이에요. ") : el("span", { class: "no" }, "오답이에요. 정답은 " + (p.answer + 1) + "번. "),
        p.explain || "") : null,
      reveal && st ? el("div", { class: "stat" }, "푼 사람 " + st.n + "명 · 정답률 " + Math.round(st.rate * 100) + "%"
        + (st.wj >= 0 && st.wshare >= 0.25 ? " · 많이 고른 오답 " + (st.wj + 1) + "번 (" + Math.round(st.wshare * 100) + "%)" : "")) : null,
      reveal && st && st.suspect ? el("div", { class: "warnline" }, "주의: 많은 사람이 " + (st.wj + 1) + "번을 골랐어요. 정답이 틀렸을 수도 있으니 해설을 꼭 확인하고, 이상하면 '오류 신고'를 눌러주세요.") : null,
      foot.length ? el("div", { class: "qfoot" }, foot) : null,
      reportBox
    );
  }

  function updateStarCount() {
    const so = [...$("f-view").options].find((o) => o.value === "star");
    if (so) so.textContent = "별표한 문제 (" + S.problems.filter((p) => S.stars[p.id]).length + ")";
  }
  function renderProblems() {
    const done = S.problems.filter((p) => S.answers[p.id] !== undefined);
    const right = done.filter((p) => S.answers[p.id] === p.answer).length;
    const due = dueList().length, st = streak(), td = S.daily[today()] || 0;
    $("score").textContent = S.problems.length
      ? "푼 문제 " + done.length + " / " + S.problems.length + " · 정답 " + right + " · 오답 " + (done.length - right)
        + (td ? " · 오늘 " + td + "문제" : "") + (st >= 2 ? " · " + st + "일 연속" : "")
        + (S.user ? "" : " · 로그인하면 기록이 폰·PC에서 이어져요")
      : "";
    const ro = [...$("f-view").options].find((o) => o.value === "review");
    if (ro) ro.textContent = "오늘 복습할 문제 (" + due + ")";
    updateStarCount();
    const wp = $("weakbox"); if (wp) wp.replaceChildren(...[weakPanel()].filter(Boolean));
    if (!S.loaded) return;
    const list = visibleProblems();
    const view = $("f-view").value;
    if (S.focus) {
      const all = el("button", { type: "button", class: "btn-line sm" }, "전체 문제 보기");
      all.addEventListener("click", () => { S.focus = ""; history.replaceState(null, "", location.pathname); renderProblems(); });
      $("qlist").replaceChildren(el("div", { class: "rule" }, "공유받은 문제예요. ", all),
        ...(list.length ? list.map((p) => card(p, p.id, "solve", S.answers[p.id], (j) => { savePick(p.id, j); renderProblems(); }))
                        : [el("div", { class: "empty" }, "이 문제를 찾을 수 없어요. 지금은 없거나 숨겨진 문제예요.")]));
      return;
    }
    if (view === "review" && list.length) {
      $("qlist").replaceChildren(
        el("div", { class: "rule" }, "예전에 틀린 문제를 1일 · 3일 · 7일 뒤에 다시 보여줘요. 복습 날에 맞히면 다음 간격으로 넘어가고, 세 번 맞히면 졸업이에요."),
        ...list.map((p) => card(p, p.id, "solve", S.reviewPicks[p.id], (j) => { S.reviewPicks[p.id] = j; savePick(p.id, j); renderProblems(); })));
      return;
    }
    if (!list.length) {
      const qv = $("f-q") ? $("f-q").value.trim() : "";
      const msg = !S.problems.length ? "아직 올라온 문제가 없어요."
        : qv ? "'" + qv + "'이(가) 들어간 문제가 없어요. 다른 낱말로 찾거나 과목·범위를 '전체'로 바꿔보세요."
        : view === "star" ? "별표한 문제가 없어요. 다시 보고 싶은 문제에서 '☆ 별표'를 누르세요."
        : view === "review" ? "오늘 복습할 문제가 없어요. 틀린 문제는 다음 날부터 여기에 나와요."
        : view === "wrong" ? "틀린 문제가 없어요. 잘하고 있어요!"
        : view === "todo" ? "이 조건의 문제는 다 풀었어요. '전체 문제'로 바꿔서 해설을 다시 보거나 다른 과목을 골라보세요."
        : "이 조건에 맞는 문제가 없어요.";
      $("qlist").replaceChildren(el("div", { class: "empty" }, msg));
      return;
    }
    const shown = list.slice(0, S.limit);
    const kids = shown.map((p) => card(p, p.id, "solve", S.answers[p.id], (j) => { savePick(p.id, j); renderProblems(); }));
    if (list.length > shown.length) {
      const more = el("button", { type: "button", class: "btn-line" }, "20문제 더 보기 (남은 " + (list.length - shown.length) + ")");
      more.addEventListener("click", () => { S.limit += 20; renderProblems(); });
      kids.push(el("div", { class: "toolbar end" }, more));
    }
    $("qlist").replaceChildren(...kids);
  }
  let searchT = 0;
  if ($("f-q")) $("f-q").addEventListener("input", () => { clearTimeout(searchT); searchT = setTimeout(() => { S.limit = 20; renderProblems(); }, 200); });
  ["f-sub", "f-co", "f-view"].forEach((id) => $(id).addEventListener("change", () => {
    store.set({ "f-sub": "sub", "f-co": "co", "f-view": "view" }[id], $(id).value); S.limit = 20; S.reviewPicks = {}; renderProblems();
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
          .select("writer,company,period,track,subject,topic,kind,level,note,status,created_at,session_id,qno")
          .order("created_at", { ascending: false }).limit(500);
        if (error) out.liveFailed = true; else out.live = data || [];
      }
      out.all = out.live.concat(out.seed);
      return out;
    })();
    return recallPromise;
  }

  /* ================= trend ================= */
  function meToo(r) {
    const b = el("button", { type: "button", class: "btn-line sm", title: "내 복기 입력칸에 이 주제를 담아요" }, "나도 나왔어요 +");
    b.addEventListener("click", () => addToDraft(r));
    return el("div", { class: "actions" }, b);
  }
  let trendCompany = "";

  /* ================= 시험 회차 (같은 날 같은 시험 복기방) ================= */
  let sessPromise = null, trendBoard = 0;
  function loadSessions(force) {
    if (!sb) return Promise.resolve([]);
    if (sessPromise && !force) return sessPromise;
    sessPromise = sb.rpc("session_list").then(({ data, error }) => (error ? [] : data || []), () => []);
    return sessPromise;
  }
  const sessLabel = (x) => x.title + " (" + String(x.exam_date).slice(5).replace("-", "/") + ")";
  function examSize(co, maxNo) {
    const e = S.exams && (S.exams.exams || []).find((x) => x.company === co);
    const n = e ? e.sections.reduce((a, c) => a + c.count, 0) : 50;
    return Math.min(100, Math.max(n, maxNo || 0));
  }
  async function numGrid(x) {
    await loadExams();
    const { data } = await sb.rpc("session_numbers", { sid: x.id });
    const m = new Map((data || []).map((r) => [Number(r.qno), r]));
    const N = examSize(x.company, Math.max(0, ...m.keys()));
    return el("div", { class: "qwrap" },
      el("div", { class: "muted" }, N + "문항 중 " + m.size + "개 번호가 채워졌어요 · 진한 칸 공개됨, 연한 칸 검사 대기"),
      el("div", { class: "qgrid" }, Array.from({ length: N }, (_, i) => {
        const r = m.get(i + 1);
        return el("span", { class: "qn" + (r ? (Number(r.shown) > 0 ? " on" : " wait") : ""), title: (i + 1) + "번 " + (r ? "복기 " + r.total + "건" : "비어 있음") }, String(i + 1));
      })));
  }
  function goFill(x) {
    const d = store.get("recallDraft", null) || {};
    d.co = x.company; d.sess = String(x.id);
    store.set("recallDraft", d);
    showTab("recall");
    window.scrollTo({ top: 0 });
  }
  function postExamSteps() {
    return el("ol", { class: "rules steps" },
      el("li", {}, el("b", {}, "시험장 나오자마자"), " 폰 메모에 번호와 키워드만 적어요. 예: ", el("code", {}, "31 RLC 공진주파수 계산"), " (문제 문장은 그대로 옮기지 않기)"),
      el("li", {}, "여기서 ", el("b", {}, "시험 회차"), "를 고르거나 새로 만들어요. 같은 날 같은 시험을 본 사람들 복기가 한곳에 번호별로 모여요."),
      el("li", {}, el("b", {}, "폰 메모 붙여넣기"), "로 한 번에 담고, 과목만 확인해서 올려요."),
      el("li", {}, "출제 경향 탭 ", el("b", {}, "시험별 복기판"), "에서 빈 번호를 보고 생각나는 걸 더 채워요. 복기판 링크를 단톡방에 공유하면 같이 채울 수 있어요."),
      el("li", {}, "다음 날 오전 9시부터 AI가 비슷한 문제로 만들어서 모의고사 탭 ", el("b", {}, "시험 회차 변형 모의고사"), "에 올려요."));
  }
  async function renderTrend() {
    const box = $("trend");
    const d = await loadRecalls();
    const all = d.all;
    const sessions = await loadSessions(true);
    if (!all.length && !sessions.length) { box.replaceChildren(el("div", { class: "empty" }, "아직 올라온 복기가 없어요. 시험 보고 왔다면 '복기 남기기'에서 첫 복기를 남겨주세요.")); return; }
    const cos = countBy(all.map((r) => r.company)).map(([k]) => k);
    const sel = el("select", { "aria-label": "기업 선택" }, el("option", { value: "" }, "전체 기업"), cos.map((c) => el("option", { value: c }, c)));
    sel.value = cos.includes(trendCompany) ? trendCompany : "";
    sel.addEventListener("change", () => { trendCompany = sel.value; renderTrend(); });
    const rs = all.filter((r) => !sel.value || r.company === sel.value);
    const bySub = countBy(rs.map((r) => r.subject));
    const max = bySub.length ? bySub[0][1] : 1;
    const ivs = d.interviews.filter((q) => !sel.value || q.company === sel.value);
    const ss = sessions.filter((x) => !sel.value || x.company === sel.value);
    const cur = ss.find((x) => x.id === trendBoard);
    let board = null;
    if (cur) {
      const fill = el("button", { type: "button", class: "btn sm" }, "빈 번호 채우러 가기");
      fill.addEventListener("click", () => goFill(cur));
      const link = el("button", { type: "button", class: "btn-line sm" }, "복기판 링크 복사");
      link.addEventListener("click", async () => {
        const url = location.origin + location.pathname + "#s=" + cur.id;
        try { await navigator.clipboard.writeText(cur.company + " " + sessLabel(cur) + " 복기판: " + url); link.textContent = "복사됐어요 · 단톡방에 붙여넣기"; }
        catch (e) { link.textContent = url; }
      });
      const rs2 = d.live.filter((r) => r.session_id === cur.id).sort((a, b) => (a.qno || 999) - (b.qno || 999));
      board = el("div", { class: "panel board" },
        el("h3", {}, cur.company + " " + sessLabel(cur)),
        el("div", { class: "empty" }, "번호 현황을 불러오는 중이에요…"),
        el("div", { class: "actions" }, fill, link),
        rs2.length ? el("div", { class: "list" }, rs2.map((r) => el("article", { class: "rec" },
          el("div", { class: "meta" }, [r.qno ? r.qno + "번" : "번호 없음", r.subject, r.kind, r.writer ? "by " + r.writer : ""].filter(Boolean).join(" · ")),
          el("div", { class: "topic" }, r.topic),
          r.note ? el("div", { class: "note" }, r.note) : null)))
          : el("p", { class: "muted" }, "아직 공개된 복기가 없어요. 올라온 복기는 검사를 통과하면 여기에 보여요."));
      numGrid(cur).then((g) => { const ph = board.querySelector(".empty"); if (ph) ph.replaceWith(g); });
    }
    const sessSec = ss.length ? [
      el("h2", {}, "시험별 복기판"),
      el("p", { class: "muted" }, "같은 날 같은 시험을 본 사람들이 번호별로 복기를 모아요. 눌러서 채워진 번호와 빈 번호를 확인하세요."),
      el("div", { class: "sesslist" }, ss.slice(0, 12).map((x) => {
        const b = el("button", { type: "button", class: "sess" + (x.id === trendBoard ? " on" : ""), "aria-pressed": String(x.id === trendBoard) },
          el("b", {}, x.company + " · " + sessLabel(x)),
          el("span", {}, "복기 " + x.recalls + " · " + x.writers + "명 · 번호 " + x.numbers + "개"));
        b.addEventListener("click", () => { trendBoard = x.id === trendBoard ? 0 : x.id; renderTrend(); });
        return b;
      })), board] : [];
    put(box,
      d.liveFailed ? el("div", { class: "empty" }, "새로 올라온 복기를 불러오지 못해서 정리된 자료만 보여드려요.") : null,
      el("div", { class: "toolbar" }, sel),
      ...sessSec,
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
        el("div", { class: "meta" }, [r.company, r.period, r.qno ? r.qno + "번" : "", r.track, r.subject, r.kind, r.level ? "난이도 " + r.level : "", r.writer ? "by " + r.writer : ""].filter(Boolean).join(" · ")),
        el("div", { class: "topic" }, r.topic),
        r.note ? el("div", { class: "note" }, r.note) : null,
        sb ? meToo(r) : null))),
      rs.length > 30 ? el("p", { class: "muted" }, "최근 30건만 보여요. 위에서 기업을 고르면 그 기업 복기만 볼 수 있어요.") : null,
      ivs.length ? el("h2", {}, "면접 기출") : null,
      ivs.length ? el("div", { class: "panel" }, el("ul", { class: "rules" }, ivs.map((q) => el("li", {}, el("b", {}, q.company), " · ", q.q)))) : null
    );
  }

  /* ================= recall submit ================= */
  function draftHint() {
    const n = ((store.get("recallDraft", null) || {}).rows || []).filter((x) => (x.topic || "").trim()).length;
    return n ? el("p", { class: "rule" }, "담아둔 주제 " + n + "개가 있어요. 로그인하면 바로 올릴 수 있어요.") : null;
  }
  function opts(sel, items) { sel.replaceChildren(...items.map((v) => el("option", { value: v }, v))); return sel; }
  async function renderRecall() {
    const box = $("recallbox");
    const rules = el("ul", { class: "rules" },
      el("li", {}, el("b", {}, "문제 원문은 그대로 옮기지 마세요."), " 어떤 주제가 어떤 식으로 나왔는지만 적어주세요. 시험 문제는 출제기관 저작물이고, 유출 금지 서약을 받는 시험도 있어요."),
      el("li", {}, "올린 복기는 검사(운영자 확인 또는 매일 오전 9시 자동 검사)를 통과하면 닉네임(김*희)과 함께 공개돼요. 그 전에는 나만 보여요."),
      el("li", {}, "욕설, 링크, 같은 글자 반복, 자음만 쓴 글, 이미 올린 주제는 올라가지 않아요. 하루 25건까지예요."),
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
        el("h3", { class: "rhead" }, "시험 보고 나오면 이렇게"), postExamSteps(),
        rules, draftHint(), el("div", { class: "actions" }, a, b)));
      return;
    }
    if (!S.realName) {
      box.replaceChildren(el("div", { class: "panel" }, el("h2", {}, "실명을 먼저 등록해 주세요"),
        el("p", {}, "복기를 올리려면 실명이 필요해요. 화면 위쪽의 '실명을 등록해 주세요' 칸에 적어주세요."), rules));
      return;
    }
    if (!S.verified && !S.isAdmin) {
      box.replaceChildren(el("div", { class: "panel" }, el("h2", {}, "실명 확인을 기다리는 중이에요"),
        el("p", {}, "운영자가 실명(" + S.realName + ")을 확인하면 복기를 올리고 랭킹에 오를 수 있어요. 그 전에도 문제 풀기와 모의고사는 다 쓸 수 있어요."),
        el("p", { class: "muted" }, "오래 걸리면 단톡방에서 운영자에게 아이디를 알려주세요."), rules));
      return;
    }
    const draft = store.get("recallDraft", null) || {};
    const last = store.get("lastRecall", {});
    const sh = {
      co: opts(el("select", { id: "r-co" }), COMPANIES), period: opts(el("select", { id: "r-period" }), PERIODS),
      track: opts(el("select", { id: "r-track" }), TRACKS),
      level: el("select", { id: "r-level" }, [["1", "1 쉬움"], ["2", "2"], ["3", "3 보통"], ["4", "4"], ["5", "5 어려움"]].map(([v, t]) => el("option", { value: v }, t)))
    };
    sh.sess = el("select", { id: "r-sess" }, el("option", { value: "" }, "회차 없이 (주제만)"));
    sh.level.value = draft.level || "3";
    for (const k of ["co", "period", "track"]) {
      const v = draft[k] || last[k];
      if (v && [...sh[k].options].some((o) => o.value === v)) sh[k].value = v;
    }
    let guess = buildGuess([]), recs = [];
    const subjOf = new Map();
    const rowsBox = el("div", { class: "rrows" });
    const topicList = el("datalist", { id: "r-topics" });
    const rows = () => [...rowsBox.children];
    let sessions = [], sessReady = false;
    const curSess = () => sessions.find((x) => String(x.id) === sh.sess.value);
    function saveDraft() {
      store.set("recallDraft", {
        co: sh.co.value, period: sh.period.value, track: sh.track.value, level: sh.level.value,
        sess: sessReady ? sh.sess.value : draft.sess || "",
        rows: rows().map((r) => ({ qno: r._f.qno.value, subject: r._f.sub.value, kind: r._f.kind.value, topic: r._f.topic.value, note: r._f.note.value, ms: !!r._f.sub.dataset.manual }))
          .filter((x) => x.topic.trim() || x.note.trim())
      });
    }
    function autoFill(f) {
      const t = f.topic.value;
      if (!f.sub.dataset.manual) f.sub.value = subjOf.get(t.trim()) || guess(t) || "";
      if (!f.kind.dataset.manual) { const k = guessKind(t); if (k) f.kind.value = k; }
    }
    function nextRow(row) {
      const nx = row.nextElementSibling;
      if (nx) nx._f.topic.focus(); else addRow(null, true);
    }
    function addRow(v, focus) {
      v = v || {};
      const f = {
        qno: el("input", { type: "number", class: "qno", min: "1", max: "100", inputmode: "numeric", placeholder: "번호", "aria-label": "문항 번호" }),
        sub: el("select", { "aria-label": "과목" }, el("option", { value: "" }, "과목 고르기"), SUBS.map((x) => el("option", { value: x }, x))),
        topic: el("input", { maxlength: "80", placeholder: "예: RL 직렬회로 유효전력 계산", autocomplete: "off", list: "r-topics", enterkeyhint: "next", "aria-label": "출제 주제" }),
        kind: opts(el("select", { "aria-label": "유형" }), KINDS),
        note: el("input", { maxlength: "300", placeholder: "메모 (선택): 물어본 방식, 함정 보기 등", autocomplete: "off", enterkeyhint: "next", "aria-label": "메모" }),
        err: el("div", { class: "msg err", role: "status" })
      };
      const del = el("button", { type: "button", class: "btn-ghost del", title: "이 줄 지우기", "aria-label": "이 줄 지우기" }, "×");
      const row = el("div", { class: "rrow" }, el("div", { class: "rline" }, f.qno, f.sub, f.topic, del), el("div", { class: "rline2" }, f.kind, f.note), f.err);
      row._f = f;
      f.topic.value = v.topic || ""; f.note.value = v.note || ""; f.qno.value = v.qno || "";
      f.qno.addEventListener("input", () => { f.err.textContent = ""; saveDraft(); });
      f.qno.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); f.topic.focus(); } });
      if (v.subject) { f.sub.value = v.subject; if (v.ms) f.sub.dataset.manual = "1"; }
      if (v.kind && KINDS.includes(v.kind)) { f.kind.value = v.kind; if (v.ms) f.kind.dataset.manual = "1"; }
      if (!v.subject && f.topic.value) autoFill(f);
      f.topic.addEventListener("input", () => { autoFill(f); f.err.textContent = ""; saveDraft(); });
      f.note.addEventListener("input", saveDraft);
      f.sub.addEventListener("change", () => { f.sub.dataset.manual = f.sub.value ? "1" : ""; saveDraft(); });
      f.kind.addEventListener("change", () => { f.kind.dataset.manual = "1"; saveDraft(); });
      for (const inp of [f.topic, f.note]) inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); nextRow(row); }
      });
      del.addEventListener("click", () => { row.remove(); if (!rows().length) addRow(); saveDraft(); });
      rowsBox.append(row);
      if (focus) f.topic.focus();
      return row;
    }
    function putTopic(t) {
      if (rows().some((r) => nrm(r._f.topic.value) === nrm(t))) return;
      const empty = rows().find((r) => !r._f.topic.value.trim());
      if (empty) { empty._f.topic.value = t; autoFill(empty._f); } else addRow({ topic: t, subject: subjOf.get(t) || guess(t) });
      saveDraft();
    }
    (draft.rows && draft.rows.length ? draft.rows : [{}, {}, {}]).forEach((v) => addRow(v));
    const chipsHead = el("div", { class: "muted" }, "이 기업에서 자주 나온 주제 · 누르면 아래에 담겨요");
    const chips = el("div", { class: "chips" });
    function fillChips() {
      const co = sh.co.value;
      let top = countBy(recs.filter((r) => r.company === co).map((r) => r.topic)).map((x) => x[0]);
      if (top.length < 8) top = top.concat(countBy(recs.map((r) => r.topic)).map((x) => x[0]).filter((t) => !top.includes(t)));
      top = top.slice(0, 12);
      chipsHead.textContent = (recs.some((r) => r.company === co) ? co + "에서" : "다른 기업에서") + " 자주 나온 주제 · 누르면 아래에 담겨요";
      chips.replaceChildren(...top.map((t) => {
        const b = el("button", { type: "button", class: "chip pick" }, "+ " + t);
        b.addEventListener("click", () => putTopic(t));
        return b;
      }));
      chipsHead.hidden = chips.hidden = !top.length;
    }
    loadRecalls().then((d) => {
      recs = d.all || [];
      recs.forEach((r) => { if (r.topic && SUBS.includes(r.subject) && !subjOf.has(r.topic)) subjOf.set(r.topic, r.subject); });
      guess = buildGuess(recs);
      const names = [...new Set(recs.map((r) => r.topic).concat(S.problems.map((p) => p.topic)).filter(Boolean))].slice(0, 500);
      topicList.replaceChildren(...names.map((t) => el("option", { value: t })));
      fillChips();
      rows().forEach((r) => { if (r._f.topic.value && !r._f.sub.value) autoFill(r._f); });
    });
    // 시험 회차: 고르면 번호 칸이 생기고, 같은 시험 본 사람들 복기와 번호별로 모여요
    const sessGrid = el("div", {});
    const sessMsg = el("span", { class: "msg", role: "status" });
    const nd = el("input", { type: "date", "aria-label": "시험 날짜" });
    nd.value = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const nt = el("input", { maxlength: "30", placeholder: "예: 필기, 1차 필기", "aria-label": "회차 이름" });
    nt.value = "필기";
    const nmk = el("button", { type: "button", class: "btn sm" }, "회차 만들기");
    const newBox = el("div", { class: "actions sessnew", hidden: "" }, nd, nt, nmk, sessMsg);
    function sessChanged() {
      newBox.hidden = sh.sess.value !== "new";
      const x = curSess();
      sh.period.disabled = !!x;
      rowsBox.classList.toggle("withno", !!x);
      sessGrid.replaceChildren();
      if (x) numGrid(x).then((g) => { if (curSess() === x) sessGrid.replaceChildren(g); });
      if (sessReady) saveDraft();
    }
    function fillSess(keep) {
      const list = sessions.filter((x) => x.company === sh.co.value);
      const want = keep != null ? keep : sh.sess.value;
      sh.sess.replaceChildren(el("option", { value: "" }, "회차 없이 (주제만)"),
        ...list.map((x) => el("option", { value: String(x.id) }, sessLabel(x) + " · 복기 " + x.recalls + "건")),
        el("option", { value: "new" }, "+ 새 회차 만들기"));
      sh.sess.value = [...sh.sess.options].some((o) => o.value === want) ? want : "";
      sessChanged();
    }
    sh.sess.addEventListener("change", sessChanged);
    nmk.addEventListener("click", async () => {
      sessMsg.className = "msg"; sessMsg.textContent = "";
      const t = nt.value.trim();
      if (!nd.value || !t) { sessMsg.textContent = "날짜와 이름을 적어주세요."; sessMsg.className = "msg err"; return; }
      nmk.disabled = true;
      const { data, error } = await sb.rpc("create_session", { co: sh.co.value, d: nd.value, t });
      nmk.disabled = false;
      if (error) { sessMsg.textContent = /[가-힣]/.test(error.message || "") ? error.message : "회차를 만들지 못했어요."; sessMsg.className = "msg err"; return; }
      sessions = await loadSessions(true);
      fillSess(String(data)); reloadSessAdmin();
    });
    loadSessions(true).then((list) => { sessions = list; sessReady = true; fillSess(draft.sess || ""); });
    sh.co.addEventListener("change", () => { fillChips(); if (sessReady) fillSess(""); saveDraft(); });
    for (const k of ["period", "track", "level"]) sh[k].addEventListener("change", saveDraft);

    const pasteTa = el("textarea", { rows: "6", "aria-label": "붙여넣을 메모",
      placeholder: "31 RLC 공진주파수 계산\n32. 동기기 전기자 반작용 종류\n33번 KEC 접지도체 굵기\n(번호 없이 적어도 돼요)" });
    const pasteBtn = el("button", { type: "button", class: "btn-line sm" }, "줄마다 나눠서 담기");
    const pasteMsg = el("span", { class: "msg", role: "status" });
    const paste = el("details", { class: "paste" }, el("summary", {}, "폰 메모를 붙여넣어서 한 번에 담기"),
      el("p", { class: "muted" }, "한 줄에 한 문제씩. 줄 앞에 번호(31, 31., 31번)가 있으면 번호 칸에 들어가요."), pasteTa, el("div", { class: "actions" }, pasteBtn, pasteMsg));
    pasteBtn.addEventListener("click", () => {
      let n = 0, numbered = 0;
      for (const raw of pasteTa.value.split(/\r?\n/)) {
        const line = raw.replace(/^[\s\-*•·]+/, "").trim();
        if (!line) continue;
        const m = line.match(/^(?:문제\s*)?(\d{1,3})\s*(?:번|\.|\)|:|-|,)?\s+(.+)$/) || line.match(/^(\d{1,3})(?:번|\.|\))(.+)$/);
        let qno = "", text = line;
        if (m && +m[1] >= 1 && +m[1] <= 100) { qno = m[1]; text = m[2].trim(); numbered++; }
        if (text.length < 2) continue;
        const topic = text.slice(0, 80), note = text.length > 80 ? text.slice(80, 380) : "";
        if (rows().some((r) => nrm(r._f.topic.value) === nrm(topic))) continue;
        const empty = rows().find((r) => !r._f.topic.value.trim() && !r._f.note.value.trim());
        if (empty) { const f = empty._f; f.topic.value = topic; f.note.value = note; f.qno.value = qno; autoFill(f); }
        else addRow({ topic, note, qno });
        n++;
      }
      if (n) { pasteTa.value = ""; saveDraft(); }
      pasteMsg.className = n ? "msg" : "msg err";
      pasteMsg.textContent = n ? n + "줄을 아래에 담았어요. 과목이 비어 있는 줄만 골라주세요." + (numbered && !curSess() ? " 번호를 살리려면 위에서 시험 회차를 고르세요." : "") : "담을 줄이 없어요.";
    });
    const msg = el("span", { class: "msg", role: "status" });
    const submit = el("button", { class: "btn", type: "submit" }, "복기 올리기");
    const more = el("button", { type: "button", class: "btn-line" }, "+ 주제 추가");
    more.addEventListener("click", () => addRow(null, true));
    const lab = (t, input) => el("div", { class: "field" }, el("label", { for: input.id }, t), input);
    const form = el("form", { class: "panel", novalidate: "" },
      el("div", { class: "rule" }, el("b", {}, myName()), " 이름으로 올라가요. 문제 원문 말고 주제와 유형만 적어주세요."),
      el("div", { class: "grid2" }, lab("기업", sh.co),
        el("div", { class: "field" }, el("label", { for: "r-sess" }, "시험 회차"), sh.sess),
        el("div", { class: "full" }, newBox, sessGrid),
        lab("시험 시기", sh.period), lab("직렬", sh.track), lab("이번 시험 체감 난이도", sh.level)),
      el("h3", { class: "rhead" }, "기억나는 주제를 한 줄에 하나씩"),
      paste, chipsHead, chips, rowsBox, topicList,
      el("p", { class: "muted" }, "Enter를 누르면 다음 줄로 넘어가요. 과목·유형은 주제를 보고 자동으로 골라요 (직접 바꿔도 돼요). 쓰던 내용은 이 기기에 자동 저장돼요."),
      el("div", { class: "actions" }, more, submit, msg));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.className = "msg"; msg.textContent = "";
      const list = rows().filter((r) => r._f.topic.value.trim() || r._f.note.value.trim());
      if (!list.length) { msg.textContent = "주제를 하나 이상 적어주세요."; msg.className = "msg err"; return; }
      let bad = 0;
      for (const r of list) {
        const f = r._f;
        const q = f.qno.value.trim();
        const why = !f.sub.value ? "과목을 골라주세요." : (curSess() && q && !/^(100|[1-9]\d?)$/.test(q)) ? "번호는 1~100 사이 숫자로 적어주세요." : checkRecallText(f.topic.value.trim(), f.note.value.trim());
        f.err.textContent = why; if (why) bad++;
      }
      if (bad) { msg.textContent = "빨간 글씨가 있는 줄을 고쳐주세요."; msg.className = "msg err"; return; }
      submit.disabled = more.disabled = true;
      const sx = curSess();
      let ok = 0, fail = 0;
      for (const [i, r] of list.entries()) {
        const f = r._f;
        msg.textContent = "올리는 중… (" + (i + 1) + "/" + list.length + ")";
        const row = { company: sh.co.value, period: sh.period.value, track: sh.track.value, subject: f.sub.value, topic: f.topic.value.trim(),
                      kind: f.kind.value, level: Number(sh.level.value), note: f.note.value.trim() || null };
        if (sx) { row.session_id = sx.id; if (f.qno.value.trim()) row.qno = Number(f.qno.value); }
        const { error } = await sb.from("recalls").insert(row);
        if (error) { fail++; f.err.textContent = /[가-힣]/.test(error.message || "") ? error.message : "올리지 못했어요. 잠시 후 다시 눌러주세요."; }
        else { ok++; r.remove(); }
      }
      submit.disabled = more.disabled = false;
      store.set("lastRecall", { co: sh.co.value, period: sh.period.value, track: sh.track.value });
      if (!rows().length) addRow();
      saveDraft();
      msg.className = fail ? "msg err" : "msg";
      msg.textContent = (ok ? ok + "건 올렸어요! 검사를 통과하면 공개되고 건당 +1점, 문제로 만들어지면 +2점 더. " : "") +
                        (fail ? fail + "건은 못 올렸어요. 남아 있는 줄의 빨간 글씨를 확인해 주세요." : "");
      if (ok) {
        loadRecalls(true); loadMine(mine);
        if (sx) loadSessions(true).then((list) => { sessions = list; fillSess(String(sx.id)); reloadSessAdmin(); });
      }
    });
    const mine = el("div", { class: "list" }, el("div", { class: "empty" }, "내 복기를 불러오는 중이에요…"));
    const admin = S.isAdmin ? el("div", { class: "list" }, el("div", { class: "empty" }, "검토할 복기를 불러오는 중이에요…")) : null;
    const members = S.isAdmin ? el("div", { class: "list" }, el("div", { class: "empty" }, "회원 목록을 불러오는 중이에요…")) : null;
    const codes = S.isAdmin ? el("div", { class: "list" }) : null;
    const reports = S.isAdmin ? el("div", { class: "list" }, el("div", { class: "empty" }, "신고를 불러오는 중이에요…")) : null;
    const sessAdmin = S.isAdmin ? el("div", { class: "list" }, el("div", { class: "empty" }, "시험 회차를 불러오는 중이에요…")) : null;
    const reloadSessAdmin = () => { if (sessAdmin) loadSessAdmin(sessAdmin, () => { loadAdmin(admin); refreshAdminCounts(); }); };
    box.replaceChildren(
      ...(S.isAdmin ? [el("h2", {}, "운영자 · 회원 실명 확인"), members, el("h2", {}, "운영자 · 공개 전 복기 검토"), admin, el("h2", {}, "운영자 · 시험 회차"), sessAdmin,
                       el("h2", {}, "운영자 · 문제 오류 신고"), reports, el("h2", {}, "운영자 · 정답 확인 필요 (자동 감지)"), suspectList(), el("h2", {}, "운영자 · 숨긴 문제"), hiddenList(), el("h2", {}, "운영자 · 개인 가입 코드"), codes] : []),
      el("div", { class: "panel" }, el("h2", {}, "복기 남기기"), el("h3", { class: "rhead" }, "시험 보고 나오면 이렇게"), postExamSteps(), rules), form, el("h2", {}, "내가 올린 복기"), mine);
    loadMine(mine);
    if (admin) loadAdmin(admin);
    if (members) loadMembers(members);
    if (codes) loadCodes(codes);
    if (reports) loadReports(reports);
    reloadSessAdmin();
    if (S.isAdmin) refreshAdminCounts();
  }

  async function refreshAdminCounts() {
    if (!S.isAdmin) return;
    const { data } = await sb.rpc("admin_counts");
    S.adminCounts = data && data[0];
    renderAccount();
  }

  async function loadReports(box) {
    const { data, error } = await sb.rpc("admin_reports");
    if (error) { box.replaceChildren(el("div", { class: "empty" }, "신고를 불러오지 못했어요.")); return; }
    if (!data.length) { box.replaceChildren(el("div", { class: "empty" }, "새 오류 신고가 없어요.")); return; }
    box.replaceChildren(
      el("p", { class: "muted" }, "정말 틀린 문제면 '문제 숨기기'를 누르세요. 사이트와 모의고사에서 바로 빠지고 신고도 해결 처리돼요. 신고가 잘못된 거면 '해결'만 누르면 돼요. (Claude가 있으면 \"오류 신고 확인해줘\"로 고쳐서 다시 보이게 할 수 있어요)"),
      ...data.map((r) => {
        const prob = (S.allProblems || S.problems).find((x) => x.id === r.problem_id);
        const done = el("button", { type: "button", class: "btn-line sm" }, "해결");
        done.addEventListener("click", async () => { const { error: err } = await sb.rpc("admin_resolve_report", { rid: r.id }); if (!err) { loadReports(box); refreshAdminCounts(); } });
        const hide = el("button", { type: "button", class: "btn sm" }, "문제 숨기기");
        armButton(hide, "문제 숨기기", "한 번 더 누르면 숨겨요", async () => {
          const { error: e1 } = await sb.rpc("admin_hide_problem", { pid: r.problem_id, why: (r.reason || "") + (r.note ? " · " + r.note : "") });
          if (e1) { hide.textContent = "숨기지 못했어요"; return; }
          await sb.rpc("admin_resolve_report", { rid: r.id });
          await loadProblems(); loadReports(box); refreshAdminCounts();
          const hl = $("hiddenlist"); if (hl) hl.replaceWith(hiddenList());
        });
        if (S.hidden && S.hidden.has(r.problem_id)) hide.disabled = true;
        return el("article", { class: "rec" },
          el("div", { class: "meta" }, [r.problem_id, prob ? prob.subject + " · " + prob.topic : "", r.reason, "by " + r.nickname, new Date(r.created_at).toLocaleDateString("ko-KR")].filter(Boolean).join(" · ")),
          el("div", { class: "topic" }, prob ? prob.q.slice(0, 80) + (prob.q.length > 80 ? "…" : "") : "(지금은 없는 문제)"),
          r.note ? el("div", { class: "note" }, r.note) : null,
          el("div", { class: "actions" }, hide, done));
      }));
  }

  // 정답률이 낮고 한 오답에 몰린 문제: 신고가 없어도 운영자에게 보여줘요
  function suspectList() {
    const okSet = store.get("statOk", {}) || {};
    const items = S.problems.map((p) => ({ p, st: statOf(p) })).filter((x) => x.st && x.st.suspect && !okSet[x.p.id]);
    const box = el("div", { class: "list", id: "suspectlist" });
    const redraw = () => { const b = $("suspectlist"); if (b) b.replaceWith(suspectList()); };
    if (!items.length) return el("div", { class: "empty", id: "suspectlist" }, "지금은 의심되는 문제가 없어요. 8명 이상 풀었는데 정답률 30% 미만이고 한 오답에 45% 넘게 몰리면 여기에 떠요.");
    box.append(el("p", { class: "muted" }, "푼 사람들이 한 오답에 몰린 문제예요. 정답이 정말 틀렸으면 '문제 숨기기', 그냥 어려운 문제면 '괜찮음'을 누르세요."));
    items.forEach(({ p, st }) => {
      const hide = el("button", { type: "button", class: "btn sm" }, "문제 숨기기");
      armButton(hide, "문제 숨기기", "한 번 더 누르면 숨겨요", async () => {
        const { error } = await sb.rpc("admin_hide_problem", { pid: p.id, why: "정답률 낮음 (자동 감지)" });
        if (error) { hide.textContent = "숨기지 못했어요"; return; }
        await loadProblems(); redraw();
        const hl = $("hiddenlist"); if (hl) hl.replaceWith(hiddenList());
      });
      const ok = el("button", { type: "button", class: "btn-line sm" }, "괜찮음");
      ok.addEventListener("click", () => { okSet[p.id] = 1; store.set("statOk", okSet); redraw(); });
      box.append(el("article", { class: "rec" },
        el("div", { class: "meta" }, [p.id, p.subject, p.topic].join(" · ")),
        el("div", { class: "topic" }, (p.q || "").slice(0, 90) + ((p.q || "").length > 90 ? "…" : "")),
        el("div", { class: "note" }, "푼 사람 " + st.n + "명 · 정답(" + (p.answer + 1) + "번) " + Math.round(st.rate * 100) + "% · "
          + st.picks.slice(0, (p.choices || []).length).map((c, j) => (j + 1) + "번 " + Math.round(c / st.n * 100) + "%").join(" / ")),
        el("div", { class: "actions" }, hide, ok)));
    });
    return box;
  }

  function hiddenList() {
    const box = el("div", { class: "list", id: "hiddenlist" });
    const items = [...(S.hidden || new Map()).values()];
    if (!items.length) return el("div", { class: "empty", id: "hiddenlist" }, "숨긴 문제가 없어요.");
    items.forEach((h) => {
      const prob = (S.allProblems || []).find((x) => x.id === h.problem_id);
      const un = el("button", { type: "button", class: "btn-line sm" }, "숨김 풀기");
      armButton(un, "숨김 풀기", "한 번 더 누르면 다시 보여요", async () => {
        const { error } = await sb.rpc("admin_unhide_problem", { pid: h.problem_id });
        if (!error) { await loadProblems(); const hl = $("hiddenlist"); if (hl) hl.replaceWith(hiddenList()); }
      });
      box.append(el("article", { class: "rec" },
        el("div", { class: "meta" }, [h.problem_id, prob ? prob.subject + " · " + prob.topic : "", h.reason, new Date(h.hidden_at).toLocaleDateString("ko-KR")].filter(Boolean).join(" · ")),
        el("div", { class: "topic" }, prob ? prob.q.slice(0, 80) + (prob.q.length > 80 ? "…" : "") : "(지금은 없는 문제)"),
        el("div", { class: "actions" }, un)));
    });
    return box;
  }

  async function loadCodes(box) {
    const name = el("input", { id: "c-name", maxlength: "5", placeholder: "후배 실명 (한글)", "aria-label": "실명" });
    const make = el("button", { type: "submit", class: "btn sm" }, "개인 코드 만들기");
    const out = el("div", { class: "msg", role: "status" });
    const form = el("form", { class: "panel", novalidate: "" },
      el("p", { class: "muted" }, "실명을 넣으면 그 사람만 쓸 수 있는 일회용 코드가 만들어져요. 1:1로 보내주면, 그 코드와 같은 실명으로 가입한 사람은 바로 '실명 확인됨'이 돼요. 코드는 지금 한 번만 보여줘요."),
      el("div", { class: "actions" }, name, make), out);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const n = name.value.trim();
      if (!/^[가-힣]{2,5}$/.test(n)) { out.textContent = "실명은 한글 2~5자로 적어주세요."; out.className = "msg err"; return; }
      make.disabled = true;
      const { data, error } = await sb.rpc("admin_create_code", { n });
      make.disabled = false;
      if (error) { out.textContent = "코드를 만들지 못했어요."; out.className = "msg err"; return; }
      const text = n + "님 가입 코드: " + data + "\nhttps://jhnp26.github.io/bokgi/ 회원가입에서 실명 '" + n + "'과 함께 입력하세요. (1회용)";
      const copy = el("button", { type: "button", class: "btn-line sm" }, "보낼 문구 복사");
      copy.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(text); copy.textContent = "복사됐어요"; } catch (err) { copy.textContent = "직접 선택해서 복사하세요"; }
      });
      out.className = "msg";
      out.replaceChildren(el("b", {}, n + " → " + data), " ", copy);
      name.value = "";
      loadCodeList(list);
    });
    const list = el("div", { class: "list" });
    box.replaceChildren(form, list);
    loadCodeList(list);
  }

  async function loadCodeList(box) {
    const { data, error } = await sb.rpc("admin_codes");
    if (error || !data.length) { box.replaceChildren(); return; }
    box.replaceChildren(...data.map((c) => {
      const kids = [el("div", { class: "meta" }, "만든 날 " + new Date(c.created_at).toLocaleDateString("ko-KR")),
        el("div", { class: "topic" }, c.real_name + (c.used ? " → 가입함 (" + (c.used_nickname || "탈퇴") + ")" : " · 아직 안 씀"))];
      if (!c.used) {
        const d = el("button", { type: "button", class: "btn-ghost" }, "코드 삭제");
        armButton(d, "코드 삭제", "한 번 더 누르면 삭제돼요", async () => { await sb.rpc("admin_delete_code", { cid: c.id }); loadCodeList(box); });
        kids.push(d);
      }
      return el("article", { class: "rec" }, kids);
    }));
  }

  let showVerified = false;
  async function loadMembers(box) {
    const { data, error } = await sb.rpc("admin_members");
    if (error) { box.replaceChildren(el("div", { class: "empty" }, "회원 목록을 불러오지 못했어요.")); return; }
    const waiting = data.filter((m) => !m.verified && !m.is_admin), done = data.filter((m) => m.verified && !m.is_admin);
    const row = (m) => {
      const kids = [
        el("div", { class: "meta" }, ["아이디 " + m.username, "닉네임 " + m.nickname, "가입 " + new Date(m.created_at).toLocaleDateString("ko-KR"), "복기 " + m.recalls + "건"].join(" · ")),
        el("div", { class: "topic" }, m.real_name || "(실명 미등록)")
      ];
      const set = (ok) => async () => { const { error: err } = await sb.rpc("admin_verify", { uid: m.id, ok }); if (!err) loadMembers(box); };
      const tmp = el("button", { type: "button", class: "btn-ghost" }, "임시 비밀번호");
      const tmpOut = el("span", { class: "msg", role: "status" });
      armButton(tmp, "임시 비밀번호", "한 번 더 누르면 비밀번호가 바뀌어요", async () => {
        const { data: pw, error: err } = await sb.rpc("admin_reset_password", { uid: m.id });
        if (err) { tmpOut.textContent = "바꾸지 못했어요."; return; }
        tmpOut.replaceChildren("임시 비밀번호: ", el("b", {}, pw), " (본인에게 1:1로 알려주고, 로그인 후 바꾸라고 해주세요)");
      });
      const del = el("button", { type: "button", class: "btn-ghost" }, "회원 삭제");
      armButton(del, "회원 삭제", "복기·기록까지 지워져요. 한 번 더 누르면 삭제", async () => {
        const { error: err } = await sb.rpc("admin_delete_member", { uid: m.id });
        if (!err) { loadRecalls(true); loadMembers(box); }
      });
      if (!m.verified) {
        const b = el("button", { type: "button", class: "btn-line sm" }, "실명 확인");
        if (!m.real_name) b.disabled = true; else b.addEventListener("click", set(true));
        kids.push(el("div", { class: "actions" }, b, tmp, del), tmpOut);
      } else {
        const b = el("button", { type: "button", class: "btn-ghost" }, "확인 취소");
        armButton(b, "확인 취소", "한 번 더 누르면 취소돼요", set(false));
        kids.push(el("div", { class: "actions" }, el("span", { class: "pill used" }, "확인됨"), b, tmp, del), tmpOut);
      }
      return el("article", { class: "rec" }, kids);
    };
    const toggle = el("button", { type: "button", class: "btn-ghost" }, showVerified ? "확인된 회원 숨기기" : "확인된 회원 " + done.length + "명 보기");
    toggle.addEventListener("click", () => { showVerified = !showVerified; loadMembers(box); });
    put(box,
      waiting.length ? el("p", { class: "muted" }, "아는 사람인지 실명을 보고 확인해 주세요. 확인된 회원만 복기를 올릴 수 있어요.") : el("div", { class: "empty" }, "확인을 기다리는 회원이 없어요."),
      ...waiting.map(row),
      done.length ? el("div", { class: "toolbar" }, toggle) : null,
      ...(showVerified ? done.map(row) : []));
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

  async function loadSessAdmin(box, changed) {
    const ss = await loadSessions(true);
    if (!ss.length) { box.replaceChildren(el("div", { class: "empty" }, "아직 만들어진 시험 회차가 없어요.")); return; }
    box.replaceChildren(
      el("p", { class: "muted" }, "같은 시험 회차 복기를 확인했으면 대기 중인 것을 한 번에 공개할 수 있어요. 장난 회차는 삭제하세요 (복기는 남고 회차 연결만 풀려요)."),
      ...ss.slice(0, 30).map((x) => {
        const acc = el("button", { type: "button", class: "btn-line sm" }, "대기 복기 모두 승인");
        armButton(acc, "대기 복기 모두 승인", "한 번 더 누르면 공개돼요", async () => {
          const { data, error } = await sb.rpc("admin_accept_session", { sid: x.id });
          if (error) { acc.textContent = "승인하지 못했어요"; return; }
          acc.textContent = data + "건 공개했어요";
          loadRecalls(true); changed();
        });
        const del = el("button", { type: "button", class: "btn-ghost" }, "회차 삭제");
        armButton(del, "회차 삭제", "한 번 더 누르면 삭제돼요", async () => {
          const { error } = await sb.rpc("admin_delete_session", { sid: x.id });
          if (!error) { loadRecalls(true); loadSessAdmin(box, changed); }
        });
        return el("article", { class: "rec" },
          el("div", { class: "meta" }, x.company + " · " + x.exam_date),
          el("div", { class: "topic" }, x.title),
          el("div", { class: "note" }, "복기 " + x.recalls + "건 · " + x.writers + "명 · 번호 " + x.numbers + "개"),
          el("div", { class: "actions" }, acc, del));
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

  // 내 약점 모의고사: 틀린 문제 + 정답률 낮은 과목 위주 20문항
  function buildWeak() {
    const acc = new Map();
    S.problems.forEach((p) => { const a = S.answers[p.id]; if (a === undefined) return; const v = acc.get(p.subject) || [0, 0]; v[1]++; if (a === p.answer) v[0]++; acc.set(p.subject, v); });
    const weakSubs = [...acc].filter(([, v]) => v[1] >= 3).sort((x, y) => x[1][0] / x[1][1] - y[1][0] / y[1][1]).slice(0, 3).map((x) => x[0]);
    const used = new Set(), pick = [];
    const take = (arr, max) => { for (const p of arr) { if (pick.length >= max) break; if (!used.has(p.id)) { used.add(p.id); pick.push(p); } } };
    take(shuffle(S.problems.filter((p) => S.answers[p.id] !== undefined && S.answers[p.id] !== p.answer)), 8);
    take(shuffle(S.problems.filter((p) => weakSubs.includes(p.subject) && S.answers[p.id] === undefined)), 20);
    take(shuffle(S.problems.filter((p) => weakSubs.includes(p.subject))), 20);
    take(shuffle(S.problems.filter((p) => S.answers[p.id] === undefined && p.subject !== "한국사")), 20);
    pick.sort((a, b) => subjRank(a.subject) - subjRank(b.subject));
    return [{ name: "약점 집중" + (weakSubs.length ? " (" + weakSubs.join("·") + ")" : ""), want: 20, items: pick }];
  }

  async function buildExam(exam) {
    if (exam.weak) return buildWeak();
    if (exam.session) {   // 시험 회차 변형 모의고사: 그 회차 복기로 만든 문제를 복기 번호 순서대로
      const items = S.problems.filter((p) => p.session === exam.session).sort((a, b) => (a.qno || 999) - (b.qno || 999));
      return [{ name: "변형 문제", want: items.length, items }];
    }
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
      const pr = el("button", { type: "button", class: "btn-ghost" }, "시험지 인쇄");
      pr.addEventListener("click", () => printExam(e));
      const mine = S.problems.filter((p) => p.company === e.company).length;
      return el("article", { class: "mockcard" },
        el("h3", {}, e.company),
        el("div", { class: "sec" }, e.sections.map((s) => s.name + " " + s.count).join(" · ") + " · 총 " + total + "문항"),
        el("div", { class: "muted" }, "이 기업 복기 기반 문제 " + mine + "개 우선 출제, 나머지는 이 기업 출제 비중대로 채워요."),
        e.note ? el("div", { class: "muted" }, e.note) : null,
        best[e.company] ? el("div", { class: "best" }, "최고 " + best[e.company].score + " / " + best[e.company].total) : null,
        el("div", { class: "actions" }, b, pr));
    });
    const ss = await loadSessions();
    const withP = ss.map((x) => ({ x, n: S.problems.filter((p) => p.session === x.id).length }));
    const sessCards = withP.filter((o) => o.n).map(({ x, n }) => {
      const key = x.company + " " + sessLabel(x);
      const b = el("button", { type: "button", class: "btn" }, "시작하기");
      b.addEventListener("click", () => startMock({ company: key, session: x.id, sections: [{ name: "변형 문제", count: n }] }));
      return el("article", { class: "mockcard" }, el("h3", {}, key),
        el("div", { class: "sec" }, "복기 번호 순서 · 총 " + n + "문항"),
        el("div", { class: "muted" }, "이 시험 복기로 AI가 만든 비슷한 문제예요."),
        best[key] ? el("div", { class: "best" }, "최고 " + best[key].score + " / " + best[key].total) : null, b);
    });
    const waiting = withP.filter((o) => !o.n && Number(o.x.recalls) > 0).length;
    const solvedN = S.problems.filter((p) => S.answers[p.id] !== undefined).length;
    let weakCard = null;
    if (solvedN >= 10) {
      const wexam = { company: "내 약점", weak: true, noRank: true, sections: [{ name: "약점 집중", count: 20 }] };
      const wb = el("button", { type: "button", class: "btn" }, "시작하기");
      wb.addEventListener("click", () => startMock(wexam));
      const wp = el("button", { type: "button", class: "btn-ghost" }, "시험지 인쇄");
      wp.addEventListener("click", () => printExam(wexam));
      weakCard = el("article", { class: "mockcard weakcard" }, el("h3", {}, "내 약점 모의고사"),
        el("div", { class: "sec" }, "20문항 · 풀 때마다 새로 뽑아요"),
        el("div", { class: "muted" }, "틀린 문제와 정답률이 낮은 과목 위주로 골라요. 푼 문제 " + solvedN + "개 기준."),
        el("div", { class: "actions" }, wb, wp));
    }
    put(box,
      sessCards.length || waiting ? el("h2", {}, "시험 회차 변형 모의고사") : null,
      waiting ? el("p", { class: "muted" }, "복기가 모인 회차 " + waiting + "개는 매일 오전 9시에 차례로 문제가 만들어지고 있어요.") : null,
      sessCards.length ? el("div", { class: "mockgrid" }, sessCards) : null,
      weakCard ? el("div", { class: "mockgrid" }, weakCard) : null,
      el("div", { class: "panel" }, el("h2", {}, "회사별 실전 모의고사"),
        el("p", {}, "실제 시험처럼 끝까지 풀고 한 번에 채점해요. 시간을 재고, 과목별 점수와 틀린 문제 해설을 보여줘요."),
        el("p", { class: "muted" }, ex.basis || "")),
      el("div", { class: "mockgrid" }, cards));
  }

  async function startMock(exam) {
    const sections = await buildExam(exam);
    S.mock = { exam, sections, picks: {}, times: {}, start: Date.now(), last: Date.now(), done: false };
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
        body.push(card(p, String(n).padStart(2, "0"), "exam", m.picks[p.id], (j) => {
          // 문항 시간: 앞 문제를 고른 뒤부터 이 문제를 처음 고를 때까지
          if (m.picks[p.id] === undefined) { const now = Date.now(); m.times[p.id] = now - m.last; m.last = now; }
          m.picks[p.id] = j; renderMock();
        }));
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
    const again = el("button", { type: "button", class: "btn" }, m.exam.weak ? "새 약점 모의고사" : "다시 풀기");
    again.addEventListener("click", () => startMock(m.exam));
    let n = 0;
    const numbered = items.map((p) => ({ p, no: ++n }));
    const wrong = numbered.filter(({ p }) => m.picks[p.id] !== p.answer);
    // 풀이 시간 분석
    const TARGET = 45;
    const tms = numbered.filter(({ p }) => m.times[p.id] != null).map(({ p, no }) => ({ p, no, s: m.times[p.id] / 1000 }));
    let timeBox = null;
    if (tms.length) {
      const avg = tms.reduce((a, x) => a + x.s, 0) / tms.length;
      const subT = new Map();
      tms.forEach(({ p, s: t }) => { const v = subT.get(p.subject) || [0, 0]; v[0] += t; v[1]++; subT.set(p.subject, v); });
      const slow = tms.slice().sort((a, b) => b.s - a.s).slice(0, 5);
      timeBox = el("div", { class: "timebox" },
        el("h3", {}, "풀이 시간"),
        el("p", {}, "문항당 평균 ", el("b", {}, Math.round(avg) + "초"), " · 목표 " + TARGET + "초" + (avg <= TARGET ? " 안쪽이에요. 좋아요!" : "보다 " + Math.round(avg - TARGET) + "초 느려요.")),
        el("div", { class: "bars" }, [...subT].sort((a, b) => subjRank(a[0]) - subjRank(b[0])).map(([k, [t, c]]) => {
          const sec = t / c, fill = el("span", { class: "fill" + (sec > TARGET ? " over" : "") });
          fill.style.width = Math.min(100, sec / (TARGET * 2) * 100) + "%";
          return el("div", { class: "bar" }, el("span", { class: "lab" }, k), el("span", { class: "track" }, fill), el("span", { class: "n" }, Math.round(sec) + "초"));
        })),
        el("p", { class: "muted" }, "오래 걸린 문제: " + slow.map(({ p, no, s: t }) => no + "번 " + p.topic + " " + Math.round(t) + "초" + (m.picks[p.id] === p.answer ? "" : " (오답)")).join(" · ")),
        el("p", { class: "muted" }, "전공은 한 문제를 40~50초 안에 푸는 연습이 필요하다는 합격 후기가 많아요. 문항 시간은 앞 문제를 고른 뒤부터 이 문제를 고를 때까지로 재요."));
    }
    // 다른 응시자와 비교
    let rankBox = null;
    if (!m.exam.noRank && sb && items.length >= 5) {
      rankBox = el("p", { class: "rankline" }, "다른 응시자와 비교하는 중…");
      (async () => {
        const k = String(m.exam.company).slice(0, 60);
        if (S.user) await sb.rpc("submit_mock", { k, s: right, t: items.length, secs: Math.min(36000, Math.round(elapsed / 1000)) });
        const { data, error } = await sb.rpc("mock_rank", { k, ratio: right / items.length });
        const r = data && data[0];
        if (error || !r) { rankBox.textContent = ""; return; }
        rankBox.textContent = r.others >= 4
          ? "이 모의고사 응시자 " + (r.others + 1) + "명 중 " + (r.higher + 1) + "등 · 상위 " + Math.max(1, Math.ceil((r.higher + 1) / (r.others + 1) * 100)) + "%"
            + (S.user ? "" : " (로그인하면 내 기록도 순위에 들어가요)")
          : "아직 이 모의고사 응시자가 적어요 (" + r.others + "명). 더 모이면 상위 몇 %인지 보여드려요." + (S.user ? "" : " 로그인하면 내 기록도 들어가요.");
      })();
    }
    put($("mock"),
      el("div", { class: "result" },
        el("h2", {}, m.exam.company + " 모의고사 결과"),
        el("div", { class: "big" }, right + " / " + items.length),
        el("p", {}, "정답률 " + Math.round(right / Math.max(1, items.length) * 100) + "% · 걸린 시간 " + fmt(elapsed)),
        rankBox,
        el("div", { class: "bars" }, [...bySub].sort((a, b) => subjRank(a[0]) - subjRank(b[0])).map(([s, [r, t]]) => {
          const fill = el("span", { class: "fill" }); fill.style.width = (r / t * 100) + "%";
          return el("div", { class: "bar" }, el("span", { class: "lab" }, s), el("span", { class: "track" }, fill), el("span", { class: "n" }, r + "/" + t));
        })),
        el("div", { class: "actions" }, again, back)),
      timeBox,
      el("h2", {}, wrong.length ? "틀리거나 안 푼 문제 " + wrong.length + "개" : "전부 맞혔어요!"),
      el("div", { class: "list" }, wrong.map(({ p, no }) => card(p, String(no).padStart(2, "0") + " · " + p.id, "review", m.picks[p.id]))));
    window.scrollTo({ top: 0 });
  }

  // 시험지 인쇄: 문제지 + 마지막 장에 정답·해설
  async function printExam(exam) {
    const sections = await buildExam(exam);
    const items = sections.flatMap((x) => x.items);
    const circ = ["①", "②", "③", "④", "⑤"];
    const back = el("button", { type: "button", class: "btn-line" }, "모의고사 목록");
    back.addEventListener("click", () => { document.body.classList.remove("printing"); renderMockHome(); window.scrollTo({ top: 0 }); });
    const pr = el("button", { type: "button", class: "btn" }, "인쇄하기 / PDF 저장");
    pr.addEventListener("click", () => window.print());
    let n = 0;
    document.body.classList.add("printing");
    put($("mock"),
      el("div", { class: "panel noprint" },
        el("p", {}, "아래 시험지를 인쇄하거나, 인쇄 창에서 'PDF로 저장'을 고르면 파일로 받을 수 있어요. 정답과 해설은 마지막 장에 있어요. 누를 때마다 문제를 새로 뽑아요."),
        el("div", { class: "actions" }, pr, back)),
      el("div", { class: "sheet" },
        el("div", { class: "sheethead" }, el("b", {}, exam.company + " 모의고사"), el("span", {}, items.length + "문항 · 이름 __________ · 점수 _____ / " + items.length)),
        sections.map((sec) => el("section", { class: "sheetsec" }, el("h3", {}, sec.name),
          sec.items.map((p) => { n++; return el("div", { class: "pq" }, el("p", { class: "pqt" }, el("b", {}, n + ". "), p.q || ""), el("ol", { class: "pch" }, (p.choices || []).map((c, j) => el("li", {}, circ[j] + " " + c)))); }))),
        el("div", { class: "answers" }, el("h3", {}, "정답과 해설"),
          el("p", { class: "akey" }, items.map((p, i) => (i + 1) + "-" + circ[p.answer]).join("  ")),
          items.map((p, i) => el("p", { class: "pa" }, el("b", {}, (i + 1) + ". " + circ[p.answer] + " "), p.explain || "")))));
    window.scrollTo({ top: 0 });
  }

  /* ================= 공식 암기 카드 ================= */
  let CARDS = null, cardDeck = null, cardIdx = 0, cardFlip = false;
  let cardSub = store.get("cardSub", ""), cardMode = store.get("cardMode", "today");
  async function loadCards() {
    if (CARDS) return CARDS;
    try { const r = await fetch("data/formulas.json", { cache: "no-cache" }); CARDS = (await r.json()).cards || []; }
    catch (e) { CARDS = []; }
    return CARDS;
  }
  const cardDue = (c) => { const r = S.cardRev[c.id]; return !!r && !r.done && r.due <= Date.now(); };
  const cardHard = (c) => { const r = S.cardRev[c.id]; return !!r && !r.done && r.step === 0; };
  function makeDeck(all) {
    const pool = all.filter((c) => !cardSub || c.subject === cardSub);
    if (cardMode === "all") return pool;
    if (cardMode === "hard") return pool.filter(cardHard);
    return pool.filter(cardDue).concat(pool.filter((c) => !S.cardRev[c.id]).slice(0, 10));   // 오늘: 복습 + 새 카드 10장
  }
  function gradeCard(c, ok) {
    const r = S.cardRev[c.id], now = Date.now();
    if (!ok) S.cardRev[c.id] = { step: 0, due: now + DAY };
    else { const step = r && !r.done ? r.step + 1 : 1; S.cardRev[c.id] = step >= GAPS.length ? { done: true, step } : { step, due: now + GAPS[step] * DAY }; }
    store.set("cardRev", S.cardRev);
  }
  async function renderCards() {
    const box = $("cards");
    const all = await loadCards();
    if (!all.length) { put(box, el("div", { class: "empty" }, "공식 카드를 불러오지 못했어요. 새로고침해 주세요.")); return; }
    if (!cardDeck) { cardDeck = makeDeck(all); cardIdx = 0; cardFlip = false; }
    const inSub = (c) => !cardSub || c.subject === cardSub;
    const subs = [...new Set(all.map((c) => c.subject))];
    const sSel = el("select", { "aria-label": "과목" }, el("option", { value: "" }, "전체 과목 (" + all.length + ")"),
      subs.map((x) => el("option", { value: x }, x + " (" + all.filter((c) => c.subject === x).length + ")")));
    sSel.value = subs.includes(cardSub) ? cardSub : "";
    const dueN = all.filter((c) => inSub(c) && cardDue(c)).length, newN = all.filter((c) => inSub(c) && !S.cardRev[c.id]).length;
    const mSel = el("select", { "aria-label": "카드 범위" },
      el("option", { value: "today" }, "오늘 볼 카드 (복습 " + dueN + " + 새 카드 " + Math.min(10, newN) + ")"),
      el("option", { value: "hard" }, "헷갈리는 카드 (" + all.filter((c) => inSub(c) && cardHard(c)).length + ")"),
      el("option", { value: "all" }, "전체 카드 차례대로"),
      el("option", { value: "list" }, "한눈에 보기 (목록)"));
    mSel.value = cardMode;
    const reset = () => { cardDeck = null; renderCards(); };
    sSel.addEventListener("change", () => { cardSub = sSel.value; store.set("cardSub", cardSub); reset(); });
    mSel.addEventListener("change", () => { cardMode = mSel.value; store.set("cardMode", cardMode); reset(); });
    const doneN = all.filter((c) => S.cardRev[c.id] && S.cardRev[c.id].done).length;
    const head = [el("div", { class: "toolbar" }, sSel, mSel),
      el("div", { class: "scoreline" }, "외운 카드 " + doneN + " / " + all.length + " · '알았어요' 세 번이면 졸업, 헷갈린 카드는 내일 다시")];
    if (cardMode === "list") {
      put(box, ...head, el("div", { class: "list" }, all.filter(inSub).map((c) => el("article", { class: "fcard flat" },
        el("div", { class: "meta" }, c.subject), el("h3", {}, c.front), el("div", { class: "fback" }, c.back), c.tip ? el("p", { class: "ftip" }, c.tip) : null))));
      return;
    }
    if (cardIdx >= cardDeck.length) {
      const again = el("button", { type: "button", class: "btn" }, "다시 섞어서 보기");
      again.addEventListener("click", reset);
      const list = el("button", { type: "button", class: "btn-line" }, "한눈에 보기");
      list.addEventListener("click", () => { cardMode = "list"; store.set("cardMode", "list"); reset(); });
      put(box, ...head, el("div", { class: "panel" },
        el("h2", {}, cardDeck.length ? "다 봤어요!" : "지금 볼 카드가 없어요"),
        el("p", {}, cardDeck.length ? cardDeck.length + "장을 봤어요. 헷갈린 카드는 내일, 안 카드는 3일·7일 뒤에 다시 나와요." : "오늘 복습할 카드가 없어요. 다른 과목이나 '전체 카드'를 골라보세요."),
        el("div", { class: "actions" }, again, list)));
      return;
    }
    const c = cardDeck[cardIdx];
    const face = el("div", { class: "fcard" + (cardFlip ? " open" : ""), role: "button", tabindex: "0", "aria-label": cardFlip ? "앞면으로 뒤집기" : "답 확인하기" },
      el("div", { class: "meta" }, c.subject + " · " + (cardIdx + 1) + " / " + cardDeck.length),
      el("h3", {}, c.front),
      cardFlip ? el("div", { class: "fback" }, c.back) : el("p", { class: "muted" }, "공식을 먼저 떠올려 보고, 눌러서 확인하세요"),
      cardFlip && c.tip ? el("p", { class: "ftip" }, c.tip) : null);
    const flip = () => { cardFlip = !cardFlip; renderCards(); };
    face.addEventListener("click", flip);
    face.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
    const next = (ok) => { gradeCard(c, ok); cardIdx++; cardFlip = false; renderCards(); };
    const no = el("button", { type: "button", class: "btn-line" }, "헷갈려요");
    no.addEventListener("click", () => next(false));
    const yes = el("button", { type: "button", class: "btn" }, "알았어요");
    yes.addEventListener("click", () => next(true));
    put(box, ...head, face, cardFlip ? el("div", { class: "actions cardbtns" }, no, yes) : null);
    if (cardFlip) yes.focus({ preventScroll: true }); else face.focus({ preventScroll: true });
  }

  /* ================= start ================= */
  renderAccount();
  const hash = (location.hash || "").slice(1);
  if (hash.startsWith("q=")) { S.focus = decodeURIComponent(hash.slice(2)); showTab("solve"); }
  else if (hash.startsWith("s=")) { trendBoard = Number(hash.slice(2)) || 0; trendCompany = ""; showTab("trend"); }
  else showTab(TABS.includes(hash) ? hash : (store.get("tab", "solve") || "solve"));
  window.addEventListener("hashchange", () => {
    const h = (location.hash || "").slice(1);
    if (h.startsWith("q=")) { S.focus = decodeURIComponent(h.slice(2)); showTab("solve"); renderProblems(); window.scrollTo({ top: 0 }); }
    if (h.startsWith("s=")) { trendBoard = Number(h.slice(2)) || 0; trendCompany = ""; showTab("trend"); window.scrollTo({ top: 0 }); }
  });
  loadProblems().then(() => { if (!$("p-mock").hidden && !S.mock) renderMockHome(); });
  if (sb) {
    sb.auth.getSession().then(({ data }) => onSession(data.session));
    sb.auth.onAuthStateChange((_ev, session) => { setTimeout(() => onSession(session), 0); });
  }
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
