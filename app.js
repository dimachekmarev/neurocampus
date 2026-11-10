/* Нейрокампус — учебное приложение, статический кабинет */
(function () {
  const KEY = "neurocampus.v1";
  const $app = document.getElementById("app");

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function storageAvailable() {
    try {
      const k = "__nc_test";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }
  const CAN_STORE = storageAvailable();

  function loadState() {
    if (!CAN_STORE) return { lessons: {}, lastId: null };
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!raw || typeof raw !== "object") return { lessons: {}, lastId: null };
      return { lessons: raw.lessons || {}, lastId: raw.lastId || null };
    } catch {
      return { lessons: {}, lastId: null };
    }
  }

  function saveState(state) {
    if (!CAN_STORE) return;
    localStorage.setItem(KEY, JSON.stringify({ v: 1, ...state }));
  }

  let state = loadState();

  function lessonState(id) {
    return state.lessons[id] || { done: false, task: false, notes: "", quiz: {} };
  }

  function patchLesson(id, patch) {
    const cur = lessonState(id);
    state.lessons[id] = { ...cur, ...patch, updated: new Date().toISOString() };
    state.lastId = id;
    saveState(state);
  }

  const COURSE = window.NEUROCAMPUS;
  if (!COURSE) {
    $app.innerHTML = "<p style='padding:40px'>Не загрузился файл программы. Обновите страницу, и если ошибка останется — напишите нам.</p>";
    return;
  }

  const allLessons = [];
  COURSE.modules.forEach((m) => m.lessons.forEach((l) => allLessons.push({ ...l, moduleId: m.id, moduleTitle: m.title })));
  const lessonMap = Object.fromEntries(allLessons.map((l) => [l.id, l]));
  const readyLessons = allLessons.filter((l) => l.status === "ready");

  function doneCount() {
    return readyLessons.filter((l) => lessonState(l.id).done).length;
  }
  function progressPct() {
    return readyLessons.length ? Math.round((doneCount() / readyLessons.length) * 100) : 0;
  }
  function firstUndone() {
    return readyLessons.find((l) => !lessonState(l.id).done) || readyLessons[0] || null;
  }
  function continueLesson() {
    if (state.lastId && lessonMap[state.lastId]) return lessonMap[state.lastId];
    return firstUndone();
  }
  function lessonsWord(n) {
    const n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return n + " урок";
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return n + " урока";
    return n + " уроков";
  }

  function neighbors(id) {
    const i = readyLessons.findIndex((l) => l.id === id);
    return {
      prev: i > 0 ? readyLessons[i - 1] : null,
      next: i >= 0 && i < readyLessons.length - 1 ? readyLessons[i + 1] : null,
      index: i
    };
  }

  function parseRoute() {
    const raw = (location.hash || "#/").replace(/^#/, "");
    const parts = raw.split("/").filter(Boolean);
    if (parts.length === 0) return { name: "home" };
    const a = parts[0];
    if (a === "course") return { name: "course" };
    if (a === "program") return { name: "program" };
    if (a === "glossary") return { name: "glossary" };
    if (a === "notebook") return { name: "notebook" };
    if (a === "lesson" && parts[1]) return { name: "lesson", id: decodeURIComponent(parts[1]) };
    return { name: "notfound" };
  }

  function go(hash) {
    location.hash = hash.startsWith("#") ? hash : "#" + hash;
  }

  function header(active) {
    const pct = progressPct();
    return `
      <header class="site-header">
        <div class="header-inner">
          <a class="brand" href="#/">
            <span class="brand-mark" aria-hidden="true">Н</span>
            <span>
              <span class="brand-name">Нейрокампус</span>
              <span class="brand-sub">Smart Agent AI</span>
            </span>
          </a>
          <button class="nav-toggle" type="button" data-action="menu" aria-expanded="false" aria-label="Открыть меню">
            <span></span>
          </button>
          <nav class="nav" aria-label="Разделы">
            <a href="#/course" ${active === "course" ? 'aria-current="page"' : ""}>Курс</a>
            <a href="#/program" ${active === "program" ? 'aria-current="page"' : ""}>Программа</a>
            <a href="#/glossary" ${active === "glossary" ? 'aria-current="page"' : ""}>Словарь</a>
            <a href="#/notebook" ${active === "notebook" ? 'aria-current="page"' : ""}>Тетрадь</a>
            ${firstUndone() && active !== "home" ? `<a class="nav-cta" href="#/lesson/${esc(firstUndone().id)}">Продолжить</a>` : ""}
          </nav>
        </div>
        <div class="progress-thin" aria-hidden="true"><i style="width:${pct}%"></i></div>
      </header>`;
  }

  function footer() {
    return `
      <footer class="site-footer">
        <div class="footer-inner">
          <div>Нейрокампус · Дмитрий Чекмарёв · <a href="https://smart-agent-ai.ru" target="_blank" rel="noopener">Smart Agent AI</a></div>
          <div>Предварительная сборка, без оплаты на этой странице</div>
        </div>
      </footer>`;
  }

  function shell(active, main) {
    return `${header(active)}<main id="main">${main}</main>${footer()}`;
  }


  function foundationModules() {
    return COURSE.modules.filter((m) => m.track === "foundation" || (!m.track && (m.part === "A" || m.id === "sites-cycle")));
  }

  function practiceModules() {
    return COURSE.modules.filter((m) => m.track === "practice" || m.part === "C");
  }

  function trackModules() {
    return foundationModules();
  }

  function moduleState(mod) {
    const ready = mod.lessons.filter((l) => l.status === "ready");
    const done = ready.filter((l) => lessonState(l.id).done).length;
    const next = firstUndone();
    const isCurrent = next && mod.lessons.some((l) => l.id === next.id);
    if (!ready.length) return "soon";
    if (isCurrent) return "current";
    if (ready.length && done === ready.length) return "done";
    return "todo";
  }

  function moduleShort(m) {
    return ({
      start: "Старт",
      ai: "Что такое ИИ",
      assistants: "Ассистенты",
      prompts: "Промпты",
      github: "GitHub",
      "sites-start": "Первые шаги",
      "sites-cycle": "Полный цикл",
      access: "Доступ",
      work: "Работа и учёба",
      images: "Изображения",
      video: "Видео и звук",
      automation: "Автоматизация",
      "sites-law": "Сайт и закон",
      money: "Заработок",
      project30: "Проект 30 дней"
    })[m.id] || m.title;
  }

  function renderPathRail(mods, startAt, label) {
    const next = firstUndone();
    return `
      <ol class="path-rail" aria-label="${esc(label)}">
        ${mods.map((m, i) => {
          const st = moduleState(m);
          const ready = m.lessons.filter((l) => l.status === "ready");
          const href = st === "soon" ? "#/course" : (next && m.lessons.some((l) => l.id === next.id) ? "#/lesson/" + next.id : "#/course");
          const done = ready.filter((l) => lessonState(l.id).done).length;
          const sub = st === "current" ? "вы здесь" : (ready.length ? (done + " / " + ready.length) : "скоро");
          return `<li class="${st}"><a href="${href}"><span class="path-dot">${startAt + i + 1}</span><span class="path-label">${esc(moduleShort(m))}</span><span class="path-sub">${sub}</span></a></li>`;
        }).join("")}
      </ol>`;
  }

  function renderPath() {
    const first = foundationModules();
    const second = practiceModules();
    return `
      <div class="path-groups">
        <div class="path-group">
          <div class="path-group-head"><p class="kicker">Фундамент и сайт</p><p>Модули 1–${first.length}</p></div>
          ${renderPathRail(first, 0, "Фундамент и сайт")}
        </div>
        <div class="path-group">
          <div class="path-group-head"><p class="kicker">Практика и проект</p><p>Модули ${first.length + 1}–${first.length + second.length}</p></div>
          ${renderPathRail(second, first.length, "Практика и проект")}
        </div>
      </div>`;
  }

  function progressRing(pct) {
    const r = 34, c = 2 * Math.PI * r;
    const dash = Math.round((pct / 100) * c);
    return `<div class="ring" aria-hidden="true">
      <svg viewBox="0 0 84 84">
        <circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--bg-2)" stroke-width="6"/>
        <circle cx="42" cy="42" r="${r}" fill="none" stroke="var(--forest)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${dash} ${c}"/>
      </svg>
      <span class="ring-label">${pct}%</span>
    </div>`;
  }


  function itemText(it) {
    if (typeof it === "string") return { t: it, d: "" };
    return { t: it.t || it.title || "", d: it.d || it.text || "" };
  }

  function renderVisual(visual) {
    if (!visual) return "";
    const items = (visual.items || []).map(itemText);
    const title = visual.title ? `<figcaption>${esc(visual.title)}</figcaption>` : "";
    let inner = "";
    const typ = visual.type || "steps";
    if (typ === "compare") {
      inner = `<div class="viz-compare">${items.map((it, i) => `<div class="viz-pane"><span class="viz-k">${i === 0 ? "А" : "Б"}</span><strong>${esc(it.t)}</strong><p>${esc(it.d)}</p></div>`).join("")}</div>`;
    } else if (typ === "trio") {
      inner = `<div class="viz-trio">${items.map((it, i) => `<div class="viz-tile"><span class="viz-num">${i + 1}</span><strong>${esc(it.t)}</strong><p>${esc(it.d)}</p></div>`).join("")}</div>`;
    } else if (typ === "cycle" || typ === "flow" || typ === "path" || typ === "steps") {
      inner = `<ol class="viz-steps viz-${typ}">${items.map((it, i) => `<li><span class="viz-num">${i + 1}</span><div><strong>${esc(it.t)}</strong><p>${esc(it.d)}</p></div></li>`).join("")}</ol>`;
    } else if (typ === "stack" || typ === "anatomy") {
      inner = `<ol class="viz-stack">${items.map((it, i) => `<li><span class="viz-num">${i + 1}</span><div><strong>${esc(it.t)}</strong><p>${esc(it.d)}</p></div></li>`).join("")}</ol>`;
    } else {
      inner = `<ol class="viz-steps">${items.map((it, i) => `<li><span class="viz-num">${i + 1}</span><div><strong>${esc(it.t)}</strong><p>${esc(it.d)}</p></div></li>`).join("")}</ol>`;
    }
    return `<figure class="visual" data-visual="${esc(typ)}">${title}${inner}</figure>`;
  }

  function renderComingSoon() {
    const items = COURSE.comingSoon || [];
    if (!items.length) return "";
    return `
      <section class="soon-block" aria-label="Следующие темы">
        <p class="kicker">Скоро</p>
        <h2>Следующие темы</h2>
        <p class="lede">Конспекты появятся по очереди. Здесь только названия — без пустых страниц.</p>
        <ul class="soon-grid">
          ${items.map((it) => `<li><strong>${esc(it.title)}</strong><span>${esc(it.text || "")}</span></li>`).join("")}
        </ul>
      </section>`;
  }

  function renderToolsStrip() {
    return `
      <div class="tools-strip" aria-label="Инструменты курса">
        <p class="kicker">Инструменты курса</p>
        <ul>
          <li><strong>Grok</strong><span>Думать и писать на grok.com</span></li>
          <li><strong>Grok Bot</strong><span>Поручить понятную задачу</span></li>
          <li><strong>Claude Code</strong><span>Собирать проект в вашей папке</span></li>
        </ul>
      </div>`;
  }

  function linkify(s) {
    return esc(s).replace(/https:\/\/[^\s<]+/g, (u) => {
      const clean = u.replace(/[),.;]+$/, "");
      return `<a href="${clean}" target="_blank" rel="noopener">${clean}</a>` + u.slice(clean.length);
    });
  }

  function renderHome() {
    const next = continueLesson();
    const started = doneCount() > 0 || state.lastId;
    const modulesReady = trackModules();
    const first = readyLessons[0];
    return shell("home", `
      <div class="wrap">
        <section class="hero">
          <div class="hero-bgword" aria-hidden="true">Курс</div>
          <div>
            <p class="kicker pill">Онлайн-курс · для всех, кто учится</p>
            <h1>Научитесь делать сайты и проекты с ИИ — простым языком</h1>
            <p class="lede">Онлайн-курс для студентов и для всех, кто учится самостоятельно. Короткие уроки, понятный конспект, схема и одно задание после каждого шага. Даже если вы ещё не работали ни с нейросетями, ни с сайтами.</p>
            <div class="btn-row">
              <a class="btn btn-terra" href="${started ? "#/course" : "#/lesson/" + (next ? next.id : "m0-how-campus")}">${started ? "Продолжить обучение" : "Начать учиться"}</a>
              <a class="btn btn-ghost" href="#/program">Смотреть программу</a>
            </div>
            <p class="hero-meta">${lessonsWord(readyLessons.length)} с конспектом и заданием · без оплаты в этой сборке</p>
          </div>
          <div class="hero-visual">
            <div class="hero-stage">
              <a class="hero-miniplayer" href="#/lesson/${esc((next || first).id)}" aria-label="Открыть текущий урок">
                <div class="play" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
                <span>${started ? "Продолжить с этого места" : "Ваш первый урок"}</span>
                <strong>${esc((next || first).title)}</strong>
              </a>
              <aside class="hero-card" aria-label="Как устроен урок">
                <p class="kicker">Как устроен каждый урок</p>
                <ol>
                  <li><span class="step-n">1</span><div><strong>Схема</strong><span>Короткая визуальная подсказка по теме. Видео появится в этом же слоте позже.</span></div></li>
                  <li><span class="step-n">2</span><div><strong>Простой конспект</strong><span>Главное можно перечитать за минуту, без замудрённых терминов.</span></div></li>
                  <li><span class="step-n">3</span><div><strong>Одно задание</strong><span>Урок заканчивается действием, а не «просто посмотреть».</span></div></li>
                  <li><span class="step-n">4</span><div><strong>Самопроверка</strong><span>Два-три вопроса, чтобы понять, что уже ясно, а что стоит повторить.</span></div></li>
                </ol>
              </aside>
            </div>
          </div>
        </section>
      </div>
      <section class="path-section">
        <div class="wrap">${renderPath()}</div>
      </section>
      <section class="section">
        <div class="wrap">
          <div class="section-head">
            <p class="kicker">Путь курса</p>
            <h2>Пятнадцать модулей: фундамент, сайт и практика</h2>
            <p class="lede">Сначала основы ИИ, запросы, Grok, Grok Bot, Claude Code, GitHub и полный цикл учебного сайта. Затем — официальный доступ, работа и учёба, изображения, видео, автоматизация, закон, заработок и проект на 30 дней. Все модули уже с конспектом и заданием, без пустых страниц.</p>
          </div>
          <h3 class="path-block-title">Фундамент и сайт</h3>
          <div class="grid-3">
            ${modulesReady.map((m, i) => `
              <a class="card path-card" href="#/course">
                <div class="n"><em>${i + 1}</em> Модуль ${i + 1}</div>
                <h3>${esc(m.title)}</h3>
                <p>${esc(m.subtitle)}</p>
                <p class="meta">${lessonsWord(m.lessons.filter((l) => l.status === "ready").length)} · готовы</p>
              </a>`).join("")}
          </div>
          <h3 class="path-block-title" style="margin-top:36px">Практика и проект</h3>
          <div class="grid-3">
            ${practiceModules().map((m, i) => `
              <a class="card path-card" href="#/course">
                <div class="n"><em>${modulesReady.length + i + 1}</em> Модуль ${modulesReady.length + i + 1}</div>
                <h3>${esc(m.title)}</h3>
                <p>${esc(m.subtitle)}</p>
                <p class="meta">${lessonsWord(m.lessons.filter((l) => l.status === "ready").length)} · готовы</p>
              </a>`).join("")}
          </div>
        </div>
      </section>
      <section class="section" style="padding-top:0">
        <div class="wrap">
          ${renderToolsStrip()}
          ${renderComingSoon()}
          <div class="note">
            <strong style="color:var(--ink)">О документе об окончании.</strong>
            Это онлайн-курс для студентов и для всех, кто учится самостоятельно. Если вы проходите его в вузе, государственный документ оформляется вместе с университетом — детали ещё уточняются и на этом сайте заранее не обещаются.
          </div>
          <div class="card author" style="margin-top:20px">
            <div class="author-ava" aria-hidden="true">ДЧ</div>
            <div>
              <p class="kicker">Ведущий</p>
              <h3>Дмитрий Чекмарёв</h3>
              <p>Smart Agent AI. Курс собран так, чтобы человеку без опыта в ИИ было легко понять, что делать на каждом шаге.</p>
            </div>
          </div>
        </div>
      </section>
    `);
  }

  function moduleDoneMeta(mod) {
    const ready = mod.lessons.filter((l) => l.status === "ready");
    if (!ready.length) return "Конспект готовится";
    const n = ready.filter((l) => lessonState(l.id).done).length;
    return `${n} из ${ready.length} пройдено`;
  }

  function lessonRows(mod) {
    return mod.lessons.map((l) => {
      const st = lessonState(l.id);
      const isNext = firstUndone() && firstUndone().id === l.id;
      const cls = l.status !== "ready" ? "upcoming" : st.done ? "done" : isNext ? "next" : "";
      const badge = l.status !== "ready" ? '<span class="badge badge-soon">скоро</span>' : (l.duration ? `<span class="meta">${esc(l.duration)}</span>` : "");
      return `
        <a class="lesson-row" href="#/lesson/${esc(l.id)}">
          <span class="dot ${cls}" aria-hidden="true"></span>
          <span>${esc(l.title)}</span>
          ${badge}
        </a>`;
    }).join("");
  }

  function renderCourse() {
    const next = firstUndone();
    const cont = continueLesson();
    const pct = progressPct();
    const track = trackModules();
    return shell("course", `
      <div class="wrap page">
        ${CAN_STORE ? "" : '<div class="warn">В этом браузере нельзя сохранить прогресс (закрыто хранилище). Можно учиться, но отметки пропадут после закрытия вкладки.</div>'}
        <div class="continue">
          ${progressRing(pct)}
          <div style="flex:1">
            <p class="kicker">Ваш прогресс</p>
            <h2 style="margin-bottom:4px">${doneCount()} из ${readyLessons.length} готовых уроков</h2>
            <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
            <p class="meta" style="margin:10px 0 0">${cont ? "Сейчас: " + esc(cont.title) : "Программа ещё загружается"}</p>
          </div>
          ${next ? `<a class="btn btn-terra" href="#/lesson/${esc(next.id)}">${doneCount() ? "Продолжить" : "Начать с первого урока"}</a>` : `<a class="btn" href="#/program">Смотреть всю программу</a>`}
        </div>
        <div style="margin: 8px 0 28px">${renderPath()}</div>
        <h2>Фундамент и полный цикл сайта</h2>
        ${track.map((m) => `
          <details class="module" ${((firstUndone() && m.lessons.some((l) => l.id === firstUndone().id)) || (!firstUndone() && m === COURSE.modules[0])) ? "open" : ""}>
            <summary><span>${esc(m.title)}</span><span class="meta">${moduleDoneMeta(m)}</span></summary>
            <div class="module-body">${lessonRows(m)}</div>
          </details>
        `).join("")}
        <h2 style="margin-top:36px">Практика и проект</h2>
        ${practiceModules().map((m) => `
          <details class="module" ${(firstUndone() && m.lessons.some((l) => l.id === firstUndone().id)) ? "open" : ""}>
            <summary><span>${esc(m.title)}</span><span class="meta">${moduleDoneMeta(m)}</span></summary>
            <div class="module-body">${lessonRows(m)}</div>
          </details>
        `).join("")}
        <p style="margin-top:28px"><button class="btn btn-ghost" type="button" data-action="reset">Сбросить прогресс</button></p>
      </div>
    `);
  }

  function renderProgram() {
    const nums = Object.fromEntries(COURSE.modules.map((m, i) => [m.id, i + 1]));
    return shell("program", `
      <div class="wrap page">
        <p class="kicker">Вся программа</p>
        <h1>Путь по курсу</h1>
        <p class="lede">Пятнадцать модулей уже с конспектом, схемой и заданием. Сначала фундамент и полный цикл сайта, затем практика, заработок и учебный проект. Идите по порядку: так меньше путаницы. Пустых уроков в программе нет.</p>
        ${COURSE.modules.map((m) => `
          <section style="margin:0 0 28px">
            <h2>${nums[m.id] ? "Модуль " + nums[m.id] + ". " : ""}${esc(m.title)}</h2>
            <p class="lede" style="margin-bottom:8px">${esc(m.subtitle || "")}</p>
            <div class="card" style="padding:0">${lessonRows(m)}</div>
          </section>
        `).join("")}
      </div>
    `);
  }

  function blocksHtml(blocks) {
    if (!blocks || !blocks.length) return "";
    return blocks.map((b) => {
      if (b.type === "h") return `<h3>${esc(b.text)}</h3>`;
      if (b.type === "p") return `<p>${linkify(b.text)}</p>`;
      if (b.type === "note") return `<p class="callout">${linkify(b.text)}</p>`;
      if (b.type === "quote") return `<blockquote class="quote">${esc(b.text)}</blockquote>`;
      if (b.type === "ul") return `<ul>${b.items.map((it) => `<li>${linkify(it)}</li>`).join("")}</ul>`;
      if (b.type === "ol") return `<ol>${b.items.map((it) => `<li>${linkify(it)}</li>`).join("")}</ol>`;
      if (b.type === "prompt") {
        return `<div class="prompt"><div class="prompt-label">${esc(b.label || "Готовый запрос")}</div><button class="copy-btn" type="button" data-action="copy">Скопировать</button><div class="prompt-text">${esc(b.text)}</div></div>`;
      }
      return "";
    }).join("");
  }

  function renderLesson(id) {
    const lesson = lessonMap[id];
    if (!lesson) return renderNotFound();
    const st = lessonState(id);
    const { prev, next, index } = neighbors(id);
    const upcoming = lesson.status !== "ready";
    const chapters = (lesson.chapters || []).map((c) => `<span>${esc(c.time)} · ${esc(c.title)}</span>`).join("");
    const donor = lesson.donor ? `
      <div class="donor">
        <strong>Ролик-опора для пересъёмки.</strong>
        Это чужой материал, не урок курса: его нельзя вставлять в программу как есть.
        <div style="margin-top:6px"><a href="${esc(lesson.donor.url)}" target="_blank" rel="noopener">${esc(lesson.donor.title)}</a>${lesson.donor.channel ? " · " + esc(lesson.donor.channel) : ""}</div>
        ${lesson.donor.backup ? `<div style="margin-top:6px">Запасной: <a href="${esc(lesson.donor.backup.url)}" target="_blank" rel="noopener">${esc(lesson.donor.backup.title)}</a>${lesson.donor.backup.channel ? " · " + esc(lesson.donor.backup.channel) : ""}</div>` : ""}
        ${lesson.donor.note ? `<div style="margin-top:6px">${esc(lesson.donor.note)}</div>` : ""}
      </div>` : "";

    let body;
    if (upcoming) {
      body = `
        <div class="card">
          <p>Конспект и видео этого шага ещё готовятся. Название взято из уже существующей программы курса, текст мы не выдумываем.</p>
          ${lesson.goal ? `<p>${esc(lesson.goal)}</p>` : ""}
          <p><a class="btn" href="#/course">Вернуться в курс</a></p>
        </div>`;
    } else {
      const quiz = (lesson.quiz || []).map((q, qi) => {
        const ans = st.quiz && st.quiz[qi];
        const revealed = typeof ans === "number";
        const opts = q.a.map((opt, oi) => {
          let cls = "opt";
          if (revealed) {
            if (oi === q.c) cls += " right";
            else if (oi === ans) cls += " wrong";
          }
          return `<button class="${cls}" type="button" data-action="quiz" data-q="${qi}" data-i="${oi}">${esc(opt)}</button>`;
        }).join("");
        return `
          <div class="check-item">
            <strong>${qi + 1}. ${esc(q.q)}</strong>
            <div class="opts">${opts}</div>
            ${revealed ? `<p class="explain">${esc(q.e)}</p>` : ""}
          </div>`;
      }).join("");

      body = `
        ${chapters ? `<div class="chapters" id="chapters">${chapters}</div>` : ""}
        <div class="prose" id="notes">${blocksHtml(lesson.notes)}</div>
        <section class="task" id="task">
          <p class="kicker">Задание</p>
          <h3>${esc(lesson.task.title)}</h3>
          ${lesson.task.steps ? `<ol>${lesson.task.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
          ${lesson.task.result ? `<p><strong>На выходе:</strong> ${esc(lesson.task.result)}</p>` : ""}
          <label class="check-row">
            <input type="checkbox" data-action="task" ${st.task ? "checked" : ""}>
            <span>Я сделал это задание</span>
          </label>
        </section>
        <section class="check" id="check">
          <p class="kicker">Самопроверка</p>
          <h3>Коротко проверьте себя</h3>
          ${quiz}
        </section>
        <section class="notes-box" id="notebook-box">
          <p class="kicker">Тетрадь</p>
          <h3>Ваши заметки к уроку</h3>
          <textarea data-action="notes" placeholder="Можно написать своими словами, что получилось">${esc(st.notes || "")}</textarea>
          <p class="save-ok" data-role="saved"></p>
        </section>
        <div class="lesson-nav lesson-dock">
          ${prev ? `<a class="btn btn-ghost" href="#/lesson/${esc(prev.id)}">Назад</a>` : `<a class="btn btn-ghost" href="#/course">К курсу</a>`}
          <button class="btn ${st.done ? "" : "btn-terra"}" type="button" data-action="complete">${st.done ? "Урок отмечен · можно идти дальше" : "Отметить урок пройденным"}</button>
          ${next ? `<a class="btn ${st.done ? "btn-terra" : "btn-ghost"}" href="#/lesson/${esc(next.id)}">Следующий урок</a>` : `<a class="btn" href="#/course">Это последний готовый урок · в кабинет</a>`}
        </div>
      `;
    }

    const formatLabel = "Урок";

    return shell("course", `
      <div class="page-narrow page">
        <p class="crumbs"><a href="#/course">Курс</a> · ${esc(lesson.moduleTitle)}${index >= 0 ? " · Урок " + (index + 1) + " из " + readyLessons.length : ""}</p>
        <p class="kicker">${upcoming ? "Следующий этап" : formatLabel}${lesson.duration ? " · " + esc(lesson.duration) : ""}</p>
        <h1>${esc(lesson.title)}</h1>
        ${lesson.goal ? `<p class="lede">${esc(lesson.goal)}</p>` : ""}
        ${upcoming ? "" : `<nav class="lesson-tabs" aria-label="Части урока">
          <a href="#/lesson/${esc(id)}" data-scroll="visual">Схема</a>
          <a href="#/lesson/${esc(id)}" data-scroll="notes">Конспект</a>
          <a href="#/lesson/${esc(id)}" data-scroll="task">Задание</a>
          <a href="#/lesson/${esc(id)}" data-scroll="check">Проверка</a>
        </nav>`}
        <div class="lesson-stage" id="visual">
          ${upcoming ? "" : renderVisual(lesson.visual)}
          <p class="video-soon" id="video">${upcoming ? "Этот шаг ещё готовится." : "Видео к этому уроку появится здесь. Сейчас тему можно пройти по схеме, конспекту и заданию."}</p>
        </div>
        ${donor}
        ${body}
      </div>
    `);
  }

  function renderGlossary() {
    const terms = COURSE.glossary || [];
    return shell("glossary", `
      <div class="page-narrow page">
        <p class="kicker">33 термина</p>
        <h1>Словарь курса</h1>
        <p class="lede">Короткие определения своими словами. Начните вводить слово — список сузится.</p>
        <input class="search" type="search" data-action="filter-terms" placeholder="Найти термин" aria-label="Найти термин">
        <div data-role="terms">
          ${terms.map((t) => `<article class="term" data-term="${esc(t[0].toLowerCase())}"><h3>${esc(t[0])}</h3><p>${esc(t[1])}</p></article>`).join("")}
        </div>
      </div>
    `);
  }

  function renderNotebook() {
    const entries = allLessons
      .map((l) => ({ l, notes: (lessonState(l.id).notes || "").trim() }))
      .filter((x) => x.notes);
    return shell("notebook", `
      <div class="page-narrow page">
        <p class="kicker">Все заметки</p>
        <h1>Тетрадь</h1>
        <p class="lede">Заметки хранятся в этом браузере. Если откроете курс с другого устройства, их там пока не будет.</p>
        ${entries.length === 0 ? `<p class="empty">Пока пусто. Откройте любой урок и запишите пару строк под конспектом.</p>` :
          entries.map((x) => `
            <article class="term">
              <p class="meta">${esc(x.l.moduleTitle)}</p>
              <h3><a href="#/lesson/${esc(x.l.id)}">${esc(x.l.title)}</a></h3>
              <p style="white-space:pre-wrap">${esc(x.notes)}</p>
            </article>`).join("")}
      </div>
    `);
  }

  function renderNotFound() {
    return shell("", `
      <div class="page-narrow page">
        <p class="kicker">Нет такой страницы</p>
        <h1>Кажется, эта ссылка никуда не ведёт</h1>
        <p class="lede">Тупика нет: вернитесь в курс или на главную и продолжите с того места, где остановились.</p>
        <div class="btn-row">
          <a class="btn" href="#/course">В курс</a>
          <a class="btn btn-ghost" href="#/">На главную</a>
        </div>
      </div>
    `);
  }

  function render() {
    document.body.classList.remove("nav-open");
    const route = parseRoute();
    let html;
    if (route.name === "home") html = renderHome();
    else if (route.name === "course") html = renderCourse();
    else if (route.name === "program") html = renderProgram();
    else if (route.name === "glossary") html = renderGlossary();
    else if (route.name === "notebook") html = renderNotebook();
    else if (route.name === "lesson") html = renderLesson(route.id);
    else html = renderNotFound();
    $app.innerHTML = html;
    const titles = {
      home: "Нейрокампус — курс Дмитрия Чекмарёва",
      course: "Курс — Нейрокампус",
      program: "Программа — Нейрокампус",
      glossary: "Словарь — Нейрокампус",
      notebook: "Тетрадь — Нейрокампус",
      lesson: lessonMap[route.id] ? `${lessonMap[route.id].title} — Нейрокампус` : "Урок — Нейрокампус",
      notfound: "Страница не найдена — Нейрокампус"
    };
    document.title = titles[route.name] || titles.notfound;
    window.scrollTo(0, 0);
  }

  $app.addEventListener("click", (e) => {
    const jump = e.target.closest("[data-scroll]");
    if (jump) {
      e.preventDefault();
      const el = document.getElementById(jump.getAttribute("data-scroll"));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const menuBtn = e.target.closest("[data-action=menu]");
    if (menuBtn) {
      const open = document.body.classList.toggle("nav-open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      return;
    }
    const copy = e.target.closest("[data-action=copy]");
    if (copy) {
      const text = copy.parentElement.querySelector(".prompt-text")?.textContent || "";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => { copy.textContent = "Скопировано"; });
      }
      return;
    }
    const quiz = e.target.closest("[data-action=quiz]");
    if (quiz) {
      const id = parseRoute().id;
      const st = lessonState(id);
      const q = Number(quiz.dataset.q);
      const i = Number(quiz.dataset.i);
      const quizState = { ...(st.quiz || {}), [q]: i };
      patchLesson(id, { quiz: quizState });
      render();
      document.getElementById("check")?.scrollIntoView({ block: "nearest" });
      return;
    }
    const complete = e.target.closest("[data-action=complete]");
    if (complete) {
      const id = parseRoute().id;
      const st = lessonState(id);
      patchLesson(id, { done: !st.done });
      render();
      return;
    }
    const reset = e.target.closest("[data-action=reset]");
    if (reset) {
      if (confirm("Сбросить весь прогресс и заметки на этом устройстве?")) {
        state = { lessons: {}, lastId: null };
        saveState(state);
        render();
      }
    }
  });

  $app.addEventListener("change", (e) => {
    if (e.target.matches("[data-action=task]")) {
      const id = parseRoute().id;
      patchLesson(id, { task: e.target.checked });
    }
  });

  let notesTimer;
  $app.addEventListener("input", (e) => {
    if (e.target.matches("[data-action=notes]")) {
      const id = parseRoute().id;
      const value = e.target.value;
      clearTimeout(notesTimer);
      notesTimer = setTimeout(() => {
        patchLesson(id, { notes: value });
        const ok = $app.querySelector("[data-role=saved]");
        if (ok) ok.textContent = "Сохранено в этом браузере";
      }, 250);
    }
    if (e.target.matches("[data-action=filter-terms]")) {
      const q = e.target.value.trim().toLowerCase();
      $app.querySelectorAll("[data-term]").forEach((el) => {
        el.style.display = !q || el.dataset.term.includes(q) || el.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    }
  });

  window.addEventListener("hashchange", render);
  render();
})();
