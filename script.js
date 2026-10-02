(function () {
  "use strict";

  // ============ STORAGE ============
  const KEY = "taskflow-pro-v1";
  const FEED_KEY = "taskflow-feed-v1";

  const DEFAULT_TASKS = [
    { id: 1, title: "Design new dashboard UI", desc: "Create wireframes and high-fidelity mockups", priority: "high", due: "2025-04-07", tags: "Design", completed: false, starred: true, status: "progress" },
    { id: 2, title: "Update API documentation", desc: "Document all new endpoints", priority: "medium", due: "2025-04-06", tags: "Development", completed: true, starred: false, status: "done" },
    { id: 3, title: "Team sync meeting", desc: "Weekly catch-up with the team", priority: "high", due: "2025-04-07", tags: "Meeting", completed: false, starred: false, status: "todo" },
    { id: 4, title: "Refactor authentication flow", desc: "Switch to JWT-based auth", priority: "medium", due: "2025-04-09", tags: "Development", completed: false, starred: false, status: "progress" },
    { id: 5, title: "Prepare sprint report", desc: "Q2 sprint summary", priority: "low", due: "2025-04-05", tags: "Reporting", completed: true, starred: false, status: "done" },
    { id: 6, title: "User feedback analysis", desc: "Analyze NPS survey responses", priority: "medium", due: "2025-04-08", tags: "Research", completed: false, starred: true, status: "todo" },
    { id: 7, title: "Fix responsive issues", desc: "Mobile layout breaks on small screens", priority: "high", due: "2025-04-07", tags: "Development", completed: false, starred: false, status: "progress" },
    { id: 8, title: "Onboarding new hire", desc: "Setup accounts and intro session", priority: "low", due: "2025-04-04", tags: "HR", completed: true, starred: false, status: "done" },
    { id: 9, title: "Quarterly planning", desc: "Q3 roadmap and OKRs", priority: "high", due: "2025-04-10", tags: "Strategy", completed: false, starred: true, status: "todo" },
    { id: 10, title: "Update design system", desc: "Add new component variants", priority: "medium", due: "2025-04-03", tags: "Design", completed: true, starred: false, status: "done" },
    { id: 11, title: "Performance audit", desc: "Lighthouse + bundle analysis", priority: "medium", due: "2025-04-08", tags: "Development", completed: false, starred: false, status: "review" },
    { id: 12, title: "Write blog post", desc: "How we rebuilt our dashboard", priority: "low", due: "2025-04-02", tags: "Marketing", completed: true, starred: false, status: "done" }
  ];

  let tasks = [];
  let feed = [];
  let activeView = "dashboard";
  let currentFilter = "all";
  let searchQuery = "";
  let editingId = null;
  let selectedIds = new Set();
  let selectMode = false;
  let sortMode = "due";
  let calDate = new Date();

  // ============ HELPERS ============
  const $ = (id) => document.getElementById(id);
  const today = () => new Date().toISOString().slice(0, 10);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const uid = () => Date.now() + Math.floor(Math.random() * 1000);

  function isOverdue(t) { return !t.completed && t.due && t.due < today(); }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(tasks));
      localStorage.setItem(FEED_KEY, JSON.stringify(feed.slice(0, 50)));
    } catch (e) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      tasks = raw ? JSON.parse(raw) : [...DEFAULT_TASKS];
      if (!raw) save();

      const rawFeed = localStorage.getItem(FEED_KEY);
      feed = rawFeed ? JSON.parse(rawFeed) : [
        { type: "success", text: "Task <strong>Update API documentation</strong> completed", time: "2h ago" },
        { type: "info", text: "New task <strong>Design new dashboard UI</strong> created", time: "5h ago" },
        { type: "warning", text: "Task <strong>Fix responsive issues</strong> is now overdue", time: "Yesterday" },
        { type: "purple", text: "Tag <strong>Design</strong> was added to 3 tasks", time: "2d ago" }
      ];
    } catch (e) { tasks = [...DEFAULT_TASKS]; }
  }

  function addFeed(type, text) {
    feed.unshift({ type, text, time: "Just now" });
    if (feed.length > 50) feed.length = 50;
  }

  function toast(msg, err) {
    const t = $("toast");
    $("toastMsg").textContent = msg;
    t.querySelector("i").className = err ? "fas fa-circle-exclamation" : "fas fa-circle-check";
    t.querySelector("i").style.color = err ? "var(--danger)" : "var(--success)";
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("show"), 2400);
  }

  // ============ FILTER & SORT ============
  function filteredTasks() {
    let out = [...tasks];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      out = out.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.tags || "").toLowerCase().includes(q) ||
        (t.desc || "").toLowerCase().includes(q)
      );
    }
    if (currentFilter === "active") out = out.filter(t => !t.completed);
    else if (currentFilter === "completed") out = out.filter(t => t.completed);
    else if (currentFilter === "overdue") out = out.filter(isOverdue);
    else if (currentFilter === "starred") out = out.filter(t => t.starred);

    if (sortMode === "due") out.sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
    else if (sortMode === "priority") {
      const order = { high: 0, medium: 1, low: 2 };
      out.sort((a, b) => order[a.priority] - order[b.priority]);
    }
    else if (sortMode === "title") out.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortMode === "created") out.sort((a, b) => b.id - a.id);
    return out;
  }

  // ============ RENDER: TASK HTML ============
  function taskHTML(t) {
    const overdue = isOverdue(t);
    const selected = selectedIds.has(t.id);
    return `
      <div class="task ${t.completed ? "done" : ""} ${selected ? "selected" : ""}" data-id="${t.id}">
        ${selectMode ? `<div class="checkbox ${selected ? "checked" : ""}" data-action="select" data-id="${t.id}">${selected ? '<i class="fas fa-check"></i>' : ""}</div>` : ""}
        <div class="checkbox ${t.completed ? "checked" : ""}" data-action="toggle" data-id="${t.id}">
          ${t.completed ? '<i class="fas fa-check"></i>' : ""}
        </div>
        <div class="task-body">
          <div class="task-title">${esc(t.title)}</div>
          <div class="task-meta">
            <span><i class="far fa-calendar"></i> ${esc(t.due || "No date")}</span>
            <span class="chip tag">${esc(t.tags || "General")}</span>
            ${overdue ? '<span style="color:var(--danger);font-weight:600;"><i class="fas fa-triangle-exclamation"></i> Overdue</span>' : ""}
          </div>
        </div>
        <span class="chip ${t.priority}">${t.priority}</span>
        <div class="task-actions">
          <button class="act-btn star ${t.starred ? "active" : ""}" data-action="star" data-id="${t.id}" title="Star">
            <i class="fas fa-star"></i>
          </button>
          <button class="act-btn" data-action="edit" data-id="${t.id}" title="Edit"><i class="fas fa-pen"></i></button>
          <button class="act-btn del" data-action="delete" data-id="${t.id}" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `;
  }

  // ============ RENDER: DASHBOARD ============
  function renderDashboard() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const active = tasks.filter(t => !t.completed && !isOverdue(t)).length;
    const overdue = tasks.filter(isOverdue).length;

    $("statTotal").textContent = total;
    $("statCompleted").textContent = completed;
    $("statActive").textContent = active;
    $("statOverdue").textContent = overdue;
    $("statCompletionRate").textContent = total ? Math.round((completed / total) * 100) + "%" : "0%";

    // Recent tasks
    const recent = [...tasks].slice(0, 4);
    const list = $("dashTaskList");
    list.innerHTML = recent.length === 0
      ? `<div class="empty" style="padding:30px 16px;"><i class="fas fa-clipboard-list"></i><h4>No tasks yet</h4><p>Create your first task</p></div>`
      : recent.map(taskHTML).join("");

    // Recent feed
    const dashFeed = $("dashFeed");
    const feedIconMap = { success: "green", info: "blue", warning: "amber", purple: "purple", red: "red" };
    const feedIconFa = { success: "fa-check", info: "fa-plus", warning: "fa-exclamation", purple: "fa-tag", red: "fa-trash" };
    dashFeed.innerHTML = feed.slice(0, 4).map(f => `
      <div class="feed-item">
        <div class="feed-icon ${feedIconMap[f.type] || "blue"}"><i class="fas ${feedIconFa[f.type] || "fa-circle"}"></i></div>
        <div class="feed-body">
          <div class="feed-text">${f.text}</div>
          <div class="feed-time">${f.time}</div>
        </div>
      </div>
    `).join("");
  }

  // ============ RENDER: FULL TASKS ============
  function renderFullTasks() {
    const list = $("fullTaskList");
    const filtered = filteredTasks();

    // Counts
    $("countAll").textContent = tasks.length;
    $("countActive").textContent = tasks.filter(t => !t.completed).length;
    $("countCompleted").textContent = tasks.filter(t => t.completed).length;
    $("countOverdue").textContent = tasks.filter(isOverdue).length;
    $("countStarred").textContent = tasks.filter(t => t.starred).length;

    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty">
        <i class="fas fa-magnifying-glass"></i>
        <h4>No tasks found</h4>
        <p>Try a different filter or create a new task</p>
        <button class="btn btn-primary" onclick="document.getElementById('newTaskBtn').click()"><i class="fas fa-plus"></i> New task</button>
      </div>`;
    } else {
      list.innerHTML = filtered.map(taskHTML).join("");
    }

    // Bulk bar
    const bulkBar = $("bulkBar");
    if (selectedIds.size > 0) {
      bulkBar.classList.add("show");
      $("bulkCount").textContent = `${selectedIds.size} selected`;
    } else {
      bulkBar.classList.remove("show");
    }
  }

  // ============ RENDER: KANBAN ============
  function renderKanban() {
    const cols = { todo: [], progress: [], review: [], done: [] };
    tasks.forEach(t => {
      let status = t.status || (t.completed ? "done" : "todo");
      if (!cols[status]) status = "todo";
      cols[status].push(t);
    });

    $("kbTodo").textContent = cols.todo.length;
    $("kbProgress").textContent = cols.progress.length;
    $("kbReview").textContent = cols.review.length;
    $("kbDone").textContent = cols.done.length;

    Object.keys(cols).forEach(status => {
      const body = document.querySelector(`.kanban-body[data-status="${status}"]`);
      if (!body) return;
      body.innerHTML = cols[status].map(t => `
        <div class="kanban-card" draggable="true" data-id="${t.id}">
          <div class="kc-title">${esc(t.title)}</div>
          <div class="kc-foot">
            <span class="chip ${t.priority}">${t.priority}</span>
            <span><i class="far fa-calendar"></i> ${esc(t.due || "—")}</span>
          </div>
        </div>
      `).join("") || `<div style="text-align:center;padding:20px;font-size:11.5px;color:var(--text-soft);">Drop tasks here</div>`;
    });

    // Drag & drop
    document.querySelectorAll(".kanban-card").forEach(card => {
      card.addEventListener("dragstart", (e) => {
        card.classList.add("dragging");
        e.dataTransfer.setData("text/plain", card.dataset.id);
        e.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
    });

    document.querySelectorAll(".kanban-col").forEach(col => {
      col.addEventListener("dragover", (e) => {
        e.preventDefault();
        col.classList.add("drag-over");
      });
      col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
      col.addEventListener("drop", (e) => {
        e.preventDefault();
        col.classList.remove("drag-over");
        const id = Number(e.dataTransfer.getData("text/plain"));
        const status = col.dataset.status;
        const task = tasks.find(t => t.id === id);
        if (task && task.status !== status) {
          task.status = status;
          task.completed = status === "done";
          addFeed("info", `Task <strong>${esc(task.title)}</strong> moved to <strong>${status}</strong>`);
          save(); renderAll();
          toast("Task moved");
        }
      });
    });
  }

  // ============ RENDER: CALENDAR ============
  function renderCalendar() {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    $("calMonth").textContent = `${monthNames[month]} ${year}`;

    // Day of week headers
    const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    $("calDow").innerHTML = dows.map(d => `<div class="cal-dow">${d}</div>`).join("");

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const todayStr = today();

    let html = "";
    // Previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevDays - i;
      html += `<div class="cal-day other"><div class="cal-day-num">${d}</div></div>`;
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayTasks = tasks.filter(t => t.due === dateStr);
      const isToday = dateStr === todayStr;
      const tasksHTML = dayTasks.slice(0, 3).map(t => `
        <div class="cal-task ${t.priority}" title="${esc(t.title)}">${esc(t.title)}</div>
      `).join("");
      const more = dayTasks.length > 3 ? `<div class="cal-more">+${dayTasks.length - 3} more</div>` : "";
      html += `<div class="cal-day ${isToday ? "today" : ""}" data-date="${dateStr}">
        <div class="cal-day-num">${d}</div>
        ${tasksHTML}${more}
      </div>`;
    }
    // Next month
    const totalCells = firstDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      html += `<div class="cal-day other"><div class="cal-day-num">${d}</div></div>`;
    }

    $("calDays").innerHTML = html;

    // Click day to open new task with date prefilled
    document.querySelectorAll(".cal-day:not(.other)").forEach(el => {
      el.addEventListener("click", () => {
        openModal(null, el.dataset.date);
      });
    });
  }

  // ============ RENDER: UPCOMING ============
  function renderUpcoming() {
    const upcoming = tasks
      .filter(t => !t.completed)
      .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"))
      .slice(0, 12);

    const grid = $("upcomingGrid");
    if (upcoming.length === 0) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1;"><i class="fas fa-calendar-check"></i><h4>No upcoming tasks</h4><p>You're all caught up!</p></div>`;
      return;
    }

    grid.innerHTML = upcoming.map(t => {
      const d = t.due ? new Date(t.due) : null;
      const dateStr = d && !isNaN(d)
        ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
        : "No date";
      const overdue = isOverdue(t);
      return `
        <div class="card" style="border-left:4px solid var(--${t.priority === "high" ? "danger" : t.priority === "medium" ? "warning" : "success"});cursor:pointer;" data-action="edit" data-id="${t.id}">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:${overdue ? "var(--danger)" : "var(--text-soft)"};letter-spacing:0.06em;margin-bottom:8px;">
            <i class="far fa-calendar"></i> ${overdue ? "Overdue · " : ""}${dateStr}
          </div>
          <div style="font-size:14px;font-weight:600;margin-bottom:10px;line-height:1.4;">${esc(t.title)}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:var(--text-soft);">
            <span><i class="fas fa-tag"></i> ${esc(t.tags || "General")}</span>
            <span class="chip ${t.priority}">${t.priority}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  // ============ RENDER: ANALYTICS ============
  function renderAnalytics() {
    const total = tasks.length || 1;
    const completed = tasks.filter(t => t.completed).length;
    const active = tasks.filter(t => !t.completed && !isOverdue(t)).length;
    const overdue = tasks.filter(isOverdue).length;
    const pc = (n) => Math.round((n / total) * 100);

    $("anCompleted").textContent = pc(completed) + "%";
    $("anActive").textContent = pc(active) + "%";
    $("anOverdue").textContent = pc(overdue) + "%";
    $("barCompleted").style.width = pc(completed) + "%";
    $("barActive").style.width = pc(active) + "%";
    $("barOverdue").style.width = pc(overdue) + "%";

    const high = tasks.filter(t => t.priority === "high").length;
    const med = tasks.filter(t => t.priority === "medium").length;
    const low = tasks.filter(t => t.priority === "low").length;
    const max = Math.max(high, med, low, 1);
    $("anHighCount").textContent = high;
    $("anMedCount").textContent = med;
    $("anLowCount").textContent = low;
    $("barHigh").style.width = (high / max) * 100 + "%";
    $("barMed").style.width = (med / max) * 100 + "%";
    $("barLow").style.width = (low / max) * 100 + "%";
  }

  // ============ RENDER: TAGS ============
  function renderTags() {
    const map = {};
    tasks.forEach(t => {
      const tag = t.tags || "General";
      map[tag] = (map[tag] || 0) + 1;
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const max = sorted[0] ? sorted[0][1] : 1;
    const colors = ["var(--brand)", "var(--success)", "var(--warning)", "var(--danger)", "var(--info)", "var(--purple)"];

    $("tagsGrid").innerHTML = sorted.map(([name, count], i) => `
      <div class="tag-card" data-tag="${esc(name)}">
        <div class="tag-name"><span class="tag-dot" style="background:${colors[i % colors.length]}"></span> ${esc(name)}</div>
        <div class="tag-bar"><div style="width:${(count / max) * 100}%;background:${colors[i % colors.length]}"></div></div>
        <div class="tag-count"><span>${count} task${count !== 1 ? "s" : ""}</span><span>${Math.round((count / tasks.length) * 100)}%</span></div>
      </div>
    `).join("") || `<div class="empty" style="grid-column:1/-1;"><i class="fas fa-tags"></i><h4>No tags yet</h4><p>Add tags to your tasks to see them here</p></div>`;

    // Click to filter
    document.querySelectorAll(".tag-card").forEach(card => {
      card.addEventListener("click", () => {
        $("searchInput").value = card.dataset.tag;
        searchQuery = card.dataset.tag;
        setView("tasks");
      });
    });
  }

  // ============ RENDER: ACTIVITY ============
  function renderActivity() {
    const feedIconMap = { success: "green", info: "blue", warning: "amber", purple: "purple", red: "red" };
    const feedIconFa = { success: "fa-check", info: "fa-plus", warning: "fa-exclamation", purple: "fa-tag", red: "fa-trash" };
    $("fullFeed").innerHTML = feed.map(f => `
      <div class="feed-item">
        <div class="feed-icon ${feedIconMap[f.type] || "blue"}"><i class="fas ${feedIconFa[f.type] || "fa-circle"}"></i></div>
        <div class="feed-body">
          <div class="feed-text">${f.text}</div>
          <div class="feed-time">${f.time}</div>
        </div>
      </div>
    `).join("") || `<div class="empty"><i class="fas fa-clock-rotate-left"></i><h4>No activity yet</h4><p>Your actions will appear here</p></div>`;
  }

  // ============ RENDER ALL ============
  function renderAll() {
    renderDashboard();
    renderFullTasks();
    renderKanban();
    renderCalendar();
    renderUpcoming();
    renderAnalytics();
    renderTags();
    renderActivity();

    $("navTaskCount").textContent = tasks.filter(t => !t.completed).length;
    $("navOverdue").textContent = tasks.filter(isOverdue).length;

    refreshCharts();
  }

  // ============ VIEW SWITCHING ============
  const viewMeta = {
    dashboard: { title: "Dashboard", subtitle: "Overview of your productivity" },
    tasks: { title: "My Tasks", subtitle: "Manage all your tasks" },
    kanban: { title: "Kanban Board", subtitle: "Drag & drop task management" },
    calendar: { title: "Calendar", subtitle: "Tasks by due date" },
    upcoming: { title: "Upcoming", subtitle: "Tasks that need your attention" },
    analytics: { title: "Analytics", subtitle: "Your productivity insights" },
    tags: { title: "Tags", subtitle: "Organize with categories" },
    activity: { title: "Activity", subtitle: "Recent changes" },
    settings: { title: "Settings", subtitle: "Manage your preferences" }
  };

  function setView(view) {
    activeView = view;
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    const el = $("view-" + view);
    if (el) el.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(n => {
      n.classList.toggle("active", n.dataset.view === view);
    });

    const meta = viewMeta[view] || viewMeta.dashboard;
    $("pageTitle").textContent = meta.title;
    $("pageSubtitle").textContent = meta.subtitle;

    if (view === "dashboard" || view === "analytics") {
      setTimeout(refreshCharts, 60);
    }
    if (view === "calendar") renderCalendar();

    if (window.innerWidth <= 860) closeSidebar();
  }

  // ============ TASK ACTIONS ============
  function toggleTask(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    t.completed = !t.completed;
    if (t.completed) t.status = "done";
    else if (t.status === "done") t.status = "todo";
    addFeed(t.completed ? "success" : "info",
      t.completed ? `Task <strong>${esc(t.title)}</strong> completed` : `Task <strong>${esc(t.title)}</strong> reopened`);
    save(); renderAll();
    toast(t.completed ? "Task completed" : "Task reopened");
  }

  function deleteTask(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    if (!confirm(`Delete "${t.title}"?`)) return;
    tasks = tasks.filter(x => x.id !== id);
    selectedIds.delete(id);
    addFeed("red", `Task <strong>${esc(t.title)}</strong> deleted`);
    save(); renderAll();
    toast("Task deleted");
  }

  function starTask(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    t.starred = !t.starred;
    save(); renderAll();
    toast(t.starred ? "Task starred" : "Star removed");
  }

  function openModal(task, prefillDate) {
    editingId = task ? task.id : null;
    $("modalTitle").textContent = task ? "Edit task" : "New task";
    $("fTitle").value = task ? task.title : "";
    $("fDesc").value = task ? task.desc || "" : "";
    $("fTags").value = task ? task.tags || "" : "";
    $("fPriority").value = task ? task.priority : "medium";
    $("fDue").value = task ? task.due : (prefillDate || today());
    $("fStatus").value = task ? (task.status || "todo") : "todo";
    $("modalBg").classList.add("open");
    setTimeout(() => $("fTitle").focus(), 100);
  }

  function closeModal() {
    $("modalBg").classList.remove("open");
    editingId = null;
  }

  // ============ EVENT DELEGATION ============
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    const id = Number(target.dataset.id);
    if (action === "toggle") toggleTask(id);
    else if (action === "edit") {
      const t = tasks.find(x => x.id === id);
      if (t) openModal(t);
    }
    else if (action === "delete") deleteTask(id);
    else if (action === "star") starTask(id);
    else if (action === "select") {
      if (selectedIds.has(id)) selectedIds.delete(id);
      else selectedIds.add(id);
      renderFullTasks();
    }
  });

  // Nav
  document.querySelectorAll(".nav-item[data-view]").forEach(item => {
    item.addEventListener("click", () => setView(item.dataset.view));
  });

  // data-goto
  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-goto]");
    if (go) setView(go.dataset.goto);
  });

  // Tabs
  document.querySelectorAll("#taskTabs .tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#taskTabs .tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter = tab.dataset.filter;
      renderFullTasks();
    });
  });

  // Sort button
  $("sortBtn").addEventListener("click", () => {
    const modes = ["due", "priority", "title", "created"];
    const labels = { due: "Sort: Due date", priority: "Sort: Priority", title: "Sort: Title", created: "Sort: Newest" };
    const idx = modes.indexOf(sortMode);
    sortMode = modes[(idx + 1) % modes.length];
    $("sortBtn").innerHTML = `<i class="fas fa-arrow-down-wide-short"></i> ${labels[sortMode]}`;
    renderFullTasks();
  });

  // Select mode
  $("selectBtn").addEventListener("click", () => {
    selectMode = !selectMode;
    $("selectBtn").classList.toggle("active", selectMode);
    if (!selectMode) selectedIds.clear();
    renderFullTasks();
  });

  // New task
  $("newTaskBtn").addEventListener("click", () => openModal(null));
  $("newTaskBtnK").addEventListener("click", () => openModal(null));
  $("modalClose").addEventListener("click", closeModal);
  $("modalCancel").addEventListener("click", closeModal);
  $("modalBg").addEventListener("click", (e) => {
    if (e.target === $("modalBg")) closeModal();
  });

  // Form submit
  $("taskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = $("fTitle").value.trim();
    if (!title) return;
    const data = {
      title,
      desc: $("fDesc").value.trim(),
      tags: $("fTags").value.trim() || "General",
      priority: $("fPriority").value,
      due: $("fDue").value || today(),
      status: $("fStatus").value
    };
    if (editingId) {
      const t = tasks.find(x => x.id === editingId);
      if (t) {
        Object.assign(t, data);
        t.completed = data.status === "done";
        addFeed("info", `Task <strong>${esc(title)}</strong> updated`);
      }
      toast("Task updated");
    } else {
      tasks.unshift({ id: uid(), completed: data.status === "done", starred: false, ...data });
      addFeed("info", `New task <strong>${esc(title)}</strong> created`);
      toast("Task added");
    }
    save(); renderAll();
    closeModal();
  });

  // Bulk actions
  document.querySelectorAll("[data-bulk]").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.bulk;
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;

      if (action === "complete") {
        ids.forEach(id => {
          const t = tasks.find(x => x.id === id);
          if (t) { t.completed = true; t.status = "done"; }
        });
        addFeed("success", `${ids.length} task${ids.length > 1 ? "s" : ""} marked complete`);
        toast(`${ids.length} tasks completed`);
      } else if (action === "star") {
        ids.forEach(id => {
          const t = tasks.find(x => x.id === id);
          if (t) t.starred = true;
        });
        toast(`${ids.length} tasks starred`);
      } else if (action === "high") {
        ids.forEach(id => {
          const t = tasks.find(x => x.id === id);
          if (t) t.priority = "high";
        });
        toast(`Priority updated`);
      } else if (action === "delete") {
        if (!confirm(`Delete ${ids.length} tasks?`)) return;
        tasks = tasks.filter(t => !ids.includes(t.id));
        addFeed("red", `${ids.length} tasks deleted`);
        toast(`${ids.length} tasks deleted`);
      }
      selectedIds.clear();
      save(); renderAll();
    });
  });

  // Search
  $("searchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value.trim();
    if (activeView !== "tasks") setView("tasks");
    else renderFullTasks();
  });

  // Sidebar mobile
  function openSidebar() { $("sidebar").classList.add("open"); $("overlay").classList.add("on"); }
  function closeSidebar() { $("sidebar").classList.remove("open"); $("overlay").classList.remove("on"); }
  $("menuBtn").addEventListener("click", openSidebar);
  $("overlay").addEventListener("click", closeSidebar);
  window.addEventListener("resize", () => { if (window.innerWidth > 860) closeSidebar(); });

  // Switches
  document.querySelectorAll("[data-switch]").forEach(sw => {
    sw.addEventListener("click", () => sw.classList.toggle("on"));
  });

  // Calendar navigation
  $("calPrev").addEventListener("click", () => { calDate.setMonth(calDate.getMonth() - 1); renderCalendar(); });
  $("calNext").addEventListener("click", () => { calDate.setMonth(calDate.getMonth() + 1); renderCalendar(); });
  $("calToday").addEventListener("click", () => { calDate = new Date(); renderCalendar(); });

  // ============ THEME ============
  function applyTheme(dark) {
    document.body.classList.toggle("dark", dark);
    const icon = dark ? "fa-sun" : "fa-moon";
    $("themeBtn").innerHTML = `<i class="fas ${icon}"></i>`;
    document.querySelector("#themeNavItem i").className = `fas ${icon}`;
    $("themeSwitch").classList.toggle("on", dark);
    if (window.weeklyChart && window.priorityChart) updateChartColors();
    if (window.trendChart && window.rateChart) updateChartColors();
  }

  $("themeBtn").addEventListener("click", () => {
    const dark = !document.body.classList.contains("dark");
    applyTheme(dark);
    localStorage.setItem("tf-theme", dark ? "dark" : "light");
  });
  $("themeNavItem").addEventListener("click", () => {
    const dark = !document.body.classList.contains("dark");
    applyTheme(dark);
    localStorage.setItem("tf-theme", dark ? "dark" : "light");
  });
  $("themeSwitch").addEventListener("click", () => {
    const dark = !document.body.classList.contains("dark");
    applyTheme(dark);
    localStorage.setItem("tf-theme", dark ? "dark" : "light");
  });

  applyTheme(localStorage.getItem("tf-theme") === "dark");

  // ============ NOTIFICATIONS ============
  $("notifBtn").addEventListener("click", () => toast("You have 3 notifications"));

  // ============ COMMAND PALETTE ============
  const commands = [
    { icon: "fa-grid-2", label: "Go to Dashboard", action: () => setView("dashboard"), kbd: "G D" },
    { icon: "fa-list-check", label: "Go to My Tasks", action: () => setView("tasks"), kbd: "G T" },
    { icon: "fa-columns", label: "Go to Kanban Board", action: () => setView("kanban"), kbd: "G K" },
    { icon: "fa-calendar", label: "Go to Calendar", action: () => setView("calendar"), kbd: "G C" },
    { icon: "fa-chart-simple", label: "Go to Analytics", action: () => setView("analytics"), kbd: "G A" },
    { icon: "fa-tags", label: "Go to Tags", action: () => setView("tags") },
    { icon: "fa-gear", label: "Open Settings", action: () => setView("settings") },
    { icon: "fa-plus", label: "Create new task", action: () => openModal(null), kbd: "N" },
    { icon: "fa-moon", label: "Toggle dark mode", action: () => { applyTheme(!document.body.classList.contains("dark")); } },
    { icon: "fa-check", label: "Complete all overdue tasks", action: () => {
        tasks.filter(isOverdue).forEach(t => { t.completed = true; t.status = "done"; });
        save(); renderAll(); toast("Overdue tasks completed");
      } },
    { icon: "fa-trash", label: "Delete all completed tasks", action: () => {
        const n = tasks.filter(t => t.completed).length;
        if (!confirm(`Delete ${n} completed tasks?`)) return;
        tasks = tasks.filter(t => !t.completed);
        save(); renderAll(); toast(`${n} tasks deleted`);
      } },
    { icon: "fa-star", label: "Show starred tasks", action: () => {
        currentFilter = "starred";
        setView("tasks");
        document.querySelectorAll("#taskTabs .tab").forEach(t => t.classList.toggle("active", t.dataset.filter === "starred"));
        renderFullTasks();
      } }
  ];

  function openCmd() {
    $("cmdBg").classList.add("open");
    $("cmdInput").value = "";
    renderCmdList(commands);
    setTimeout(() => $("cmdInput").focus(), 80);
  }
  function closeCmd() { $("cmdBg").classList.remove("open"); }

  function renderCmdList(items) {
    $("cmdList").innerHTML = items.map((c, i) => `
      <div class="cmd-item ${i === 0 ? "selected" : ""}" data-cmd="${i}">
        <i class="fas ${c.icon}"></i>
        <span>${c.label}</span>
        ${c.kbd ? `<span class="kbd">${c.kbd}</span>` : ""}
      </div>
    `).join("") || `<div class="cmd-item" style="justify-content:center;color:var(--text-soft);">No commands found</div>`;
  }

  $("cmdBtn").addEventListener("click", openCmd);
  $("cmdNavItem").addEventListener("click", openCmd);
  $("cmdBg").addEventListener("click", (e) => { if (e.target === $("cmdBg")) closeCmd(); });

  $("cmdInput").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = commands.filter(c => c.label.toLowerCase().includes(q));
    renderCmdList(filtered);
  });

  $("cmdList").addEventListener("click", (e) => {
    const item = e.target.closest(".cmd-item");
    if (!item || !item.dataset.cmd) return;
    const idx = Number(item.dataset.cmd);
    const visibleCmds = commands.filter(c => {
      const q = $("cmdInput").value.toLowerCase();
      return c.label.toLowerCase().includes(q);
    });
    if (visibleCmds[idx]) {
      visibleCmds[idx].action();
      closeCmd();
    }
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === "k") {
      e.preventDefault();
      openCmd();
      return;
    }
    if (e.key === "Escape") {
      if ($("cmdBg").classList.contains("open")) closeCmd();
      else if ($("modalBg").classList.contains("open")) closeModal();
    }
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
    if (e.key === "n" || e.key === "N") { e.preventDefault(); openModal(null); }
    if (e.key === "g") {
      window._gPressed = true;
      setTimeout(() => window._gPressed = false, 800);
    }
    if (window._gPressed) {
      const map = { d: "dashboard", t: "tasks", k: "kanban", c: "calendar", a: "analytics", s: "settings" };
      const view = map[e.key.toLowerCase()];
      if (view) { setView(view); window._gPressed = false; }
    }
  });

  // ============ CHARTS ============
  function chartColors() {
    const dark = document.body.classList.contains("dark");
    return {
      text: dark ? "#94a3b8" : "#64748b",
      grid: dark ? "#232d43" : "#e8edf3",
      brand: dark ? "#818cf8" : "#6366f1",
      fill: dark ? "rgba(129,140,248,0.1)" : "rgba(99,102,241,0.08)"
    };
  }

  function buildCharts() {
    const c = chartColors();
    const common = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

    window.weeklyChart = new Chart($("chartWeekly"), {
      type: "line",
      data: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets: [{
          data: [2, 4, 3, 6, 5, 7, 4],
          borderColor: c.brand,
          backgroundColor: c.fill,
          borderWidth: 2.5,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: c.brand,
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        ...common,
        scales: {
          y: { beginAtZero: true, grid: { color: c.grid, drawBorder: false }, ticks: { color: c.text, stepSize: 2, font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { color: c.text, font: { size: 11 } } }
        }
      }
    });

    window.priorityChart = new Chart($("chartPriority"), {
      type: "doughnut",
      data: {
        labels: ["High", "Medium", "Low"],
        datasets: [{
          data: [3, 5, 4],
          backgroundColor: ["#ef4444", "#f59e0b", "#10b981"],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        ...common,
        cutout: "70%",
        plugins: {
          legend: { display: true, position: "bottom", labels: { color: c.text, usePointStyle: true, boxWidth: 8, padding: 14, font: { size: 11, weight: "500" } } }
        }
      }
    });

    window.trendChart = new Chart($("chartTrend"), {
      type: "bar",
      data: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets: [{
          data: [3, 5, 4, 7, 6, 4, 3],
          backgroundColor: c.brand,
          borderRadius: 6,
          barThickness: 22
        }]
      },
      options: {
        ...common,
        scales: {
          y: { beginAtZero: true, grid: { color: c.grid, drawBorder: false }, ticks: { color: c.text, stepSize: 2, font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { color: c.text, font: { size: 11 } } }
        }
      }
    });

    window.rateChart = new Chart($("chartRate"), {
      type: "line",
      data: {
        labels: ["W1", "W2", "W3", "W4", "W5", "W6"],
        datasets: [{
          data: [45, 52, 48, 65, 72, 78],
          borderColor: "#10b981",
          backgroundColor: "rgba(16,185,129,0.1)",
          borderWidth: 2.5,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: "#10b981",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 4
        }]
      },
      options: {
        ...common,
        scales: {
          y: { beginAtZero: true, max: 100, grid: { color: c.grid, drawBorder: false }, ticks: { color: c.text, callback: v => v + "%", font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { color: c.text, font: { size: 11 } } }
        }
      }
    });
  }

  function refreshCharts() {
    if (!window.weeklyChart) return;

    // Weekly
    const counts = [0, 0, 0, 0, 0, 0, 0];
    tasks.filter(t => t.completed && t.due).forEach(t => {
      const d = new Date(t.due);
      if (!isNaN(d)) {
        const day = d.getDay();
        const idx = day === 0 ? 6 : day - 1;
        counts[idx]++;
      }
    });
    if (counts.reduce((a, b) => a + b, 0) > 0) window.weeklyChart.data.datasets[0].data = counts;

    // Priority
    const high = tasks.filter(t => t.priority === "high").length;
    const med = tasks.filter(t => t.priority === "medium").length;
    const low = tasks.filter(t => t.priority === "low").length;
    window.priorityChart.data.datasets[0].data = [high, med, low];

    window.weeklyChart.update("none");
    window.priorityChart.update("none");
    if (window.trendChart) window.trendChart.update("none");
    if (window.rateChart) window.rateChart.update("none");
  }

  function updateChartColors() {
    const c = chartColors();
    if (window.weeklyChart) {
      window.weeklyChart.data.datasets[0].borderColor = c.brand;
      window.weeklyChart.data.datasets[0].backgroundColor = c.fill;
      window.weeklyChart.data.datasets[0].pointBackgroundColor = c.brand;
      window.weeklyChart.options.scales.y.grid.color = c.grid;
      window.weeklyChart.options.scales.y.ticks.color = c.text;
      window.weeklyChart.options.scales.x.ticks.color = c.text;
      window.weeklyChart.update("none");
    }
    if (window.priorityChart) {
      window.priorityChart.options.plugins.legend.labels.color = c.text;
      window.priorityChart.update("none");
    }
    if (window.trendChart) {
      window.trendChart.data.datasets[0].backgroundColor = c.brand;
      window.trendChart.options.scales.y.grid.color = c.grid;
      window.trendChart.options.scales.y.ticks.color = c.text;
      window.trendChart.options.scales.x.ticks.color = c.text;
      window.trendChart.update("none");
    }
    if (window.rateChart) {
      window.rateChart.options.scales.y.grid.color = c.grid;
      window.rateChart.options.scales.y.ticks.color = c.text;
      window.rateChart.options.scales.x.ticks.color = c.text;
      window.rateChart.update("none");
    }
  }

  // ============ INIT ============
  function init() {
    load();
    setView("dashboard");
    renderAll();
    buildCharts();
    setTimeout(() => { updateChartColors(); refreshCharts(); }, 100);
  }

  init();
})();