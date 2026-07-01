(() => {
  const data = window.REVIEW_DATA;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const storeKey = "erm-final-review-v1";
  const defaultState = { favorites: [], completed: [], wrongs: [], answers: {}, theme: "light", lastKnowledge: null };
  let state = loadState();
  let knowledgeChapter = "all";
  let knowledgeImportance = "all";
  let essayChapter = "all";
  let quizType = "all";
  let quizChapter = "all";
  let activeTemplate = data.templates[0].id;
  let toastTimer;

  function loadState() {
    try { return { ...defaultState, ...JSON.parse(localStorage.getItem(storeKey) || "{}") }; }
    catch { return { ...defaultState }; }
  }
  function saveState() { localStorage.setItem(storeKey, JSON.stringify(state)); updateProgress(); renderNotebook(); }
  function chapterTitle(id) {
    const chapter = data.chapters.find(c => c.id === Number(id));
    return chapter ? `第${chapter.id}章 ${chapter.title}` : "";
  }
  function importanceClass(value) {
    if (value.includes("高频") || value.includes("重中")) return "high";
    if (value.includes("中高") || value.includes("中频")) return "medium";
    return "low";
  }
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }
  function setView(viewId) {
    const valid = ["home","chapters","essays","templates","compare","quiz","notebook"];
    const id = valid.includes(viewId) ? viewId : "home";
    $$(".view").forEach(view => view.classList.toggle("active", view.id === id));
    $$("#mainNav a").forEach(link => link.classList.toggle("active", link.dataset.view === id));
    $("#mainNav").classList.remove("open");
    $("#menuButton").setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: "instant" });
    if (id === "notebook") renderNotebook();
  }
  function route() {
    const id = location.hash.replace("#", "").split("?")[0] || "home";
    setView(id);
  }

  function renderHome() {
    $("#priorityGrid").innerHTML = data.priorities.map(([title, meta]) =>
      `<button class="priority-item" data-priority="${title}"><b>${title}</b><span>${meta}</span></button>`
    ).join("");
    $("#rangeList").innerHTML = data.chapters.map(chapter =>
      `<div class="range-item"><span class="chapter-no">${chapter.id}</span><div><b>${chapter.title}</b><small>${chapter.range}</small></div><span class="frequency ${importanceClass(chapter.weight)}">${chapter.weight}</span></div>`
    ).join("");
    updateProgress();
  }

  function updateProgress() {
    const mainKnowledge = data.knowledge.filter(item => item.chapter <= 9);
    const complete = mainKnowledge.filter(item => state.completed.includes(item.id)).length;
    const percent = mainKnowledge.length ? Math.round(complete / mainKnowledge.length * 100) : 0;
    $("#progressPercent").textContent = `${percent}%`;
    $("#progressText").textContent = complete ? `已完成 ${complete} / ${mainKnowledge.length} 个核心知识点` : "还没有标记已复习知识点";
    $("#progressRing").style.setProperty("--progress", `${percent * 3.6}deg`);
    if ($("#progressBar")) $("#progressBar").style.width = `${percent}%`;
    if ($("#completedStat")) $("#completedStat").textContent = complete;
    if ($("#favoriteStat")) $("#favoriteStat").textContent = state.favorites.length;
    if ($("#wrongStat")) $("#wrongStat").textContent = state.wrongs.length;
    if ($("#lastStudyText")) {
      const last = data.knowledge.find(item => item.id === state.lastKnowledge);
      $("#lastStudyText").textContent = last ? last.title : "暂无记录";
    }
  }

  function renderChapterControls() {
    const importanceOptions = ["all","高频","中高","中频","了解"];
    $("#chapterFilters").innerHTML = importanceOptions.map(item =>
      `<button class="filter-button ${knowledgeImportance === item ? "active" : ""}" data-importance="${item}">${item === "all" ? "全部重点" : item}</button>`
    ).join("");
    $("#chapterSidebar").innerHTML = [
      `<button class="chapter-side-button ${knowledgeChapter === "all" ? "active" : ""}" data-chapter="all"><b>全</b><span>全部章节</span></button>`,
      ...data.chapters.map(chapter => `<button class="chapter-side-button ${String(knowledgeChapter) === String(chapter.id) ? "active" : ""}" data-chapter="${chapter.id}"><b>${chapter.id}</b><span>${chapter.title}</span></button>`),
    ].join("");
  }

  function renderKnowledge() {
    renderChapterControls();
    const query = $("#knowledgeSearch").value.trim().toLowerCase();
    const items = data.knowledge.filter(item => {
      const inChapter = knowledgeChapter === "all" || String(item.chapter) === String(knowledgeChapter);
      const inImportance = knowledgeImportance === "all" || item.importance.includes(knowledgeImportance);
      const haystack = [item.title, item.definition, item.memory, item.expand, item.keywords.join(" "), item.types.join(" "), item.question].join(" ").toLowerCase();
      return inChapter && inImportance && (!query || haystack.includes(query));
    });
    $("#knowledgeCount").textContent = `找到 ${items.length} 个知识点`;
    $("#knowledgeList").innerHTML = items.length ? items.map(item => {
      const completed = state.completed.includes(item.id);
      return `<article class="knowledge-card" id="${item.id}">
        <div class="knowledge-summary" data-toggle-card="${item.id}">
          <div>
            <div class="card-kicker">
              <span class="tag">${chapterTitle(item.chapter)}</span>
              <span class="tag ${importanceClass(item.importance)}">${item.importance}</span>
              ${item.types.map(type => `<span class="tag">${type}</span>`).join("")}
            </div>
            <h3>${item.title}</h3>
          </div>
          <div class="card-actions">
            <button class="memorize-toggle ${completed ? "active" : ""}" data-complete="${item.id}" title="背诵状态">${completed ? "已背" : "未背"}</button>
            <button class="round-button" title="展开">⌄</button>
          </div>
        </div>
        <div class="knowledge-body">
          <div class="answer-block"><h4>答案</h4><p>${item.memory}</p></div>
          <div class="answer-block"><h4>关键词</h4><ul class="keyword-list">${item.keywords.map(k => `<li>${k}</li>`).join("")}</ul></div>
          <div class="answer-block"><h4>易混点</h4><p>${item.confuse}</p></div>
          <div class="answer-block"><h4>教育研究例子</h4><p>${item.example}</p></div>
          <div class="answer-block"><h4>可能出题方式</h4><p>${item.question}</p></div>
        </div>
      </article>`;
    }).join("") : `<div class="empty-state">没有匹配的知识点，换个关键词试试。</div>`;
  }

  function renderEssayFilter() {
    $("#essayChapterFilter").innerHTML = `<option value="all">全部章节</option>` +
      data.chapters.map(c => `<option value="${c.id}">第${c.id}章 ${c.title}</option>`).join("");
    $("#essayChapterFilter").value = essayChapter;
  }
  function renderEssays() {
    const items = data.essays.filter(item => essayChapter === "all" || String(item.chapter) === essayChapter);
    $("#essayList").innerHTML = items.map((item, index) =>
      `<article class="essay-card" id="${item.id}">
        <div class="essay-head" data-toggle-essay="${item.id}">
          <span class="essay-number">${String(index + 1).padStart(2, "0")}</span>
          <div><h3>${item.title}</h3><p>${chapterTitle(item.chapter)} · 关键词：${item.keywords.join(" / ")}</p></div>
          <button class="round-button">⌄</button>
        </div>
        <div class="essay-body">
          <div class="score-tabs">
            <button class="score-tab active" data-score="six">6分版</button>
            <button class="score-tab" data-score="ten">10分版</button>
            <button class="score-tab" data-score="twenty">20分版</button>
          </div>
          <div class="answer-block score-content" data-score-content>${item.six}</div>
          <div class="answer-block"><h4>可以举的例子</h4><p>${item.example}</p></div>
        </div>
      </article>`
    ).join("");
  }

  function renderTemplates() {
    $("#templateTabs").innerHTML = data.templates.map(item =>
      `<button class="filter-button ${item.id === activeTemplate ? "active" : ""}" data-template="${item.id}">${item.title.replace("模板","")}</button>`
    ).join("");
    const item = data.templates.find(t => t.id === activeTemplate);
    $("#templateDetail").innerHTML = `<article class="template-card">
      <aside class="template-aside"><span class="eyebrow">适用题型</span><h2>${item.title}</h2><p>${item.use}</p><h3>答题步骤</h3><ol>${item.steps.map(step => `<li>${step}</li>`).join("")}</ol></aside>
      <div class="template-main">
        <span class="eyebrow">固定套话</span><div class="copy-box">${item.phrases}<button class="copy-button" data-copy="${item.id}-phrase">复制</button></div>
        <h3>示例题</h3><p>${item.example}</p>
        <h3>示例答案</h3><div class="copy-box" id="${item.id}-answer">${item.answer}<button class="copy-button" data-copy="${item.id}-answer">复制答案</button></div>
      </div>
    </article>`;
    const phraseButton = $(`[data-copy="${item.id}-phrase"]`);
    phraseButton.dataset.text = item.phrases;
  }

  function renderComparisons() {
    $("#comparisonGrid").innerHTML = data.comparisons.map(item =>
      `<article class="comparison-card"><div class="versus"><div><h4>${item.left}</h4><p>${item.leftText}</p></div><span>VS</span><div><h4>${item.right}</h4><p>${item.rightText}</p></div></div><p class="memory-tip">记忆钩子：${item.tip}</p></article>`
    ).join("");
  }

  function renderQuizControls() {
    const types = ["all","判断","单选"];
    $("#quizTypeFilters").innerHTML = types.map(type =>
      `<button class="filter-button ${quizType === type ? "active" : ""}" data-quiz-type="${type}">${type === "all" ? "全部题型" : type}</button>`
    ).join("");
    $("#quizChapterFilter").innerHTML = `<option value="all">全部章节</option>` +
      data.chapters.map(c => `<option value="${c.id}">第${c.id}章</option>`).join("");
    $("#quizChapterFilter").value = quizChapter;
  }
  function visibleQuizItems() {
    const wrongOnly = $("#wrongOnlyToggle").checked;
    return data.quiz.filter(item =>
      (quizType === "all" || item.type === quizType) &&
      (quizChapter === "all" || String(item.chapter) === quizChapter) &&
      (!wrongOnly || state.wrongs.includes(item.id))
    );
  }
  function renderQuiz() {
    renderQuizControls();
    const items = visibleQuizItems();
    $("#quizList").innerHTML = items.length ? items.map((item, index) => {
      const selected = state.answers[item.id];
      const answered = Number.isInteger(selected);
      return `<article class="quiz-card ${answered ? "answered" : ""}" id="${item.id}">
        <div class="quiz-meta"><span class="tag">${item.type}</span><span class="tag">${chapterTitle(item.chapter)}</span><span class="tag">第 ${index + 1} 题</span></div>
        <div class="quiz-question">${item.question}</div>
        <div class="options">${item.options.map((option, optionIndex) => {
          let className = "";
          if (answered && optionIndex === item.answer) className = "correct";
          else if (answered && optionIndex === selected) className = "wrong";
          return `<button class="option-button ${className}" data-answer="${item.id}" data-option="${optionIndex}" ${answered ? "disabled" : ""}>${String.fromCharCode(65 + optionIndex)}. ${option}</button>`;
        }).join("")}</div>
        <div class="quiz-explanation"><strong>${selected === item.answer ? "回答正确" : `正确答案：${String.fromCharCode(65 + item.answer)}`}</strong><br>${item.explanation}</div>
      </article>`;
    }).join("") : `<div class="empty-state">${$("#wrongOnlyToggle").checked ? "当前筛选下没有错题，漂亮。" : "没有匹配的题目。"}</div>`;
    updateQuizStats();
  }
  function updateQuizStats() {
    const answeredEntries = data.quiz.filter(item => Number.isInteger(state.answers[item.id]));
    const correct = answeredEntries.filter(item => state.answers[item.id] === item.answer).length;
    $("#answeredCount").textContent = answeredEntries.length;
    $("#correctCount").textContent = correct;
    $("#accuracyRate").textContent = answeredEntries.length ? `${Math.round(correct / answeredEntries.length * 100)}%` : "—";
  }

  function renderNotebook() {
    const favorites = data.knowledge.filter(item => state.favorites.includes(item.id));
    const wrongs = data.quiz.filter(item => state.wrongs.includes(item.id));
    $("#favoriteCount").textContent = favorites.length;
    $("#wrongCount").textContent = wrongs.length;
    $("#favoriteList").innerHTML = favorites.length ? favorites.map(item =>
      `<div class="saved-item"><a href="#chapters" data-open-knowledge="${item.id}">${item.title}</a><p>${chapterTitle(item.chapter)} · ${item.importance}</p></div>`
    ).join("") : `<div class="empty-state">还没有收藏知识点。</div>`;
    $("#wrongList").innerHTML = wrongs.length ? wrongs.map(item =>
      `<div class="saved-item"><a href="#quiz" data-open-wrong="${item.id}">${item.question}</a><p>${chapterTitle(item.chapter)} · ${item.type}</p></div>`
    ).join("") : `<div class="empty-state">错题本还是空的，去刷几题吧。</div>`;
  }

  function bindEvents() {
    window.addEventListener("hashchange", route);
    $("#menuButton").addEventListener("click", () => {
      const open = $("#mainNav").classList.toggle("open");
      $("#menuButton").setAttribute("aria-expanded", String(open));
    });
    $("#themeButton").addEventListener("click", () => {
      state.theme = document.body.classList.toggle("dark") ? "dark" : "light";
      saveState();
    });
    $("#knowledgeSearch").addEventListener("input", renderKnowledge);
    $("#essayChapterFilter").addEventListener("change", event => { essayChapter = event.target.value; renderEssays(); });
    $("#quizChapterFilter").addEventListener("change", event => { quizChapter = event.target.value; renderQuiz(); });
    $("#wrongOnlyToggle").addEventListener("change", renderQuiz);
    $("#resetQuizButton").addEventListener("click", () => {
      state.answers = {};
      saveState();
      renderQuiz();
      showToast("本轮答题记录已重置");
    });
    $("#resetAllButton").addEventListener("click", () => {
      if (!confirm("确定清空收藏、进度、答题记录和错题本吗？")) return;
      state = { ...defaultState, theme: state.theme };
      saveState();
      renderKnowledge(); renderQuiz(); renderNotebook();
      showToast("全部学习记录已重置");
    });
    $("#continueButton").addEventListener("click", () => {
      location.hash = "chapters";
      setTimeout(() => {
        if (state.lastKnowledge) openKnowledge(state.lastKnowledge);
        else $("#knowledgeList")?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    });
    $("#backTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    window.addEventListener("scroll", () => $("#backTop").classList.toggle("show", window.scrollY > 600));

    document.addEventListener("click", async event => {
      const importance = event.target.closest("[data-importance]");
      if (importance) { knowledgeImportance = importance.dataset.importance; renderKnowledge(); return; }
      const chapter = event.target.closest("[data-chapter]");
      if (chapter) { knowledgeChapter = chapter.dataset.chapter; renderKnowledge(); return; }
      const summary = event.target.closest("[data-toggle-card]");
      if (summary && !event.target.closest("[data-favorite]") && !event.target.closest("[data-complete]")) {
        const card = summary.closest(".knowledge-card");
        card.classList.toggle("open");
        if (card.classList.contains("open")) {
          state.lastKnowledge = summary.dataset.toggleCard;
          saveState();
        }
        return;
      }
      const favorite = event.target.closest("[data-favorite]");
      if (favorite) {
        const id = favorite.dataset.favorite;
        state.favorites = state.favorites.includes(id) ? state.favorites.filter(x => x !== id) : [...state.favorites, id];
        saveState(); renderKnowledge(); showToast(state.favorites.includes(id) ? "已加入收藏" : "已取消收藏"); return;
      }
      const complete = event.target.closest("[data-complete]");
      if (complete) {
        const id = complete.dataset.complete;
        state.completed = state.completed.includes(id) ? state.completed.filter(x => x !== id) : [...state.completed, id];
        saveState(); renderKnowledge(); showToast(state.completed.includes(id) ? "已标记为已背" : "已改为未背"); return;
      }
      const essayHead = event.target.closest("[data-toggle-essay]");
      if (essayHead) { essayHead.closest(".essay-card").classList.toggle("open"); return; }
      const scoreTab = event.target.closest("[data-score]");
      if (scoreTab) {
        const card = scoreTab.closest(".essay-card");
        const item = data.essays.find(x => x.id === card.id);
        $$(".score-tab", card).forEach(tab => tab.classList.toggle("active", tab === scoreTab));
        $("[data-score-content]", card).textContent = item[scoreTab.dataset.score];
        return;
      }
      const templateTab = event.target.closest("[data-template]");
      if (templateTab) { activeTemplate = templateTab.dataset.template; renderTemplates(); return; }
      const copy = event.target.closest("[data-copy]");
      if (copy) {
        const text = copy.dataset.text || $(`#${copy.dataset.copy}`)?.innerText.replace("复制答案", "").trim();
        try { await navigator.clipboard.writeText(text); showToast("已复制到剪贴板"); }
        catch { showToast("复制失败，请手动选择文本"); }
        return;
      }
      const quizTypeButton = event.target.closest("[data-quiz-type]");
      if (quizTypeButton) { quizType = quizTypeButton.dataset.quizType; renderQuiz(); return; }
      const homeQuiz = event.target.closest("[data-home-quiz]");
      if (homeQuiz) {
        quizType = homeQuiz.dataset.homeQuiz;
        setTimeout(renderQuiz, 20);
        return;
      }
      const answer = event.target.closest("[data-answer]");
      if (answer) {
        const id = answer.dataset.answer;
        const option = Number(answer.dataset.option);
        const item = data.quiz.find(x => x.id === id);
        state.answers[id] = option;
        if (option === item.answer) state.wrongs = state.wrongs.filter(x => x !== id);
        else if (!state.wrongs.includes(id)) state.wrongs.push(id);
        saveState(); renderQuiz(); return;
      }
      const priority = event.target.closest("[data-priority]");
      if (priority) {
        location.hash = "chapters";
        $("#knowledgeSearch").value = priority.dataset.priority.replace("完整设计","").replace("与敏感访谈","").replace("方案","");
        setTimeout(renderKnowledge, 30); return;
      }
      const openSaved = event.target.closest("[data-open-knowledge]");
      if (openSaved) { const id = openSaved.dataset.openKnowledge; setTimeout(() => openKnowledge(id), 80); return; }
      const openWrong = event.target.closest("[data-open-wrong]");
      if (openWrong) {
        $("#wrongOnlyToggle").checked = true;
        setTimeout(() => { renderQuiz(); document.getElementById(openWrong.dataset.openWrong)?.scrollIntoView({ behavior: "smooth" }); }, 80);
      }
    });
  }

  function openKnowledge(id) {
    knowledgeChapter = "all";
    knowledgeImportance = "all";
    $("#knowledgeSearch").value = "";
    renderKnowledge();
    const card = document.getElementById(id);
    if (card) { card.classList.add("open"); card.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }

  function init() {
    document.body.classList.toggle("dark", state.theme === "dark");
    renderHome();
    renderKnowledge();
    renderEssayFilter();
    renderEssays();
    renderTemplates();
    renderComparisons();
    renderQuiz();
    renderNotebook();
    bindEvents();
    route();
  }
  init();
})();
