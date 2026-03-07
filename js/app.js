const store = new window.AppStore();
const auth = new window.LocalProfileAuth(store);
const sso = new window.SsoStubAuth();

let currentUser = null;

const ui = {
  authPanel: document.getElementById("authPanel"),
  appPanel: document.getElementById("appPanel"),
  userSelect: document.getElementById("userSelect"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  createUserBtn: document.getElementById("createUserBtn"),
  newName: document.getElementById("newName"),
  newTeam: document.getElementById("newTeam"),
  newRole: document.getElementById("newRole"),
  welcomeText: document.getElementById("welcomeText"),
  userMeta: document.getElementById("userMeta"),
  completionPill: document.getElementById("completionPill"),
  certPill: document.getElementById("certPill"),
  adminTabButton: document.getElementById("adminTabButton"),
  tabs: [...document.querySelectorAll(".tab")],
  tabPanels: [...document.querySelectorAll(".tab-panel")],
  dashboardTab: document.getElementById("dashboardTab"),
  trainingTab: document.getElementById("trainingTab"),
  assignmentsTab: document.getElementById("assignmentsTab"),
  recordsTab: document.getElementById("recordsTab"),
  adminTab: document.getElementById("adminTab"),
  modalOverlay: document.getElementById("modalOverlay"),
  modalContent: document.getElementById("modalContent"),
  closeModalBtn: document.getElementById("closeModalBtn")
};

function init() {
  bindEvents();
  renderAuthModeHint();
  refreshUserSelect();
}

function bindEvents() {
  ui.loginBtn.addEventListener("click", handleLogin);
  ui.logoutBtn.addEventListener("click", handleLogout);
  ui.createUserBtn.addEventListener("click", handleCreateUser);

  ui.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activateTab(tab.dataset.tab);
    });
  });

  ui.closeModalBtn.addEventListener("click", closeModal);
  ui.modalOverlay.addEventListener("click", (event) => {
    if (event.target === ui.modalOverlay) {
      closeModal();
    }
  });
}

function renderAuthModeHint() {
  const existing = document.getElementById("authModeHint");
  if (existing) {
    existing.textContent = `${auth.describeMode()} ${sso.getSetupMessage()}`;
    return;
  }

  const hint = document.createElement("div");
  hint.id = "authModeHint";
  hint.className = "alert note auth-mode-hint";
  hint.textContent = `${auth.describeMode()} ${sso.getSetupMessage()}`;
  ui.authPanel.appendChild(hint);
}

function handleLogin() {
  const id = ui.userSelect.value;
  if (!id) {
    alert("Select a user profile first.");
    return;
  }

  const user = auth.signIn(id);
  if (!user) {
    alert("Selected user was not found.");
    return;
  }

  currentUser = user;
  ui.authPanel.classList.add("hidden");
  ui.appPanel.classList.remove("hidden");
  ui.logoutBtn.classList.remove("hidden");

  ui.adminTabButton.classList.toggle("hidden", currentUser.role !== "supervisor");
  activateTab("dashboardTab");
  renderAll();
}

function handleLogout() {
  auth.signOut();
  currentUser = null;
  ui.appPanel.classList.add("hidden");
  ui.authPanel.classList.remove("hidden");
  ui.logoutBtn.classList.add("hidden");
  closeModal();
}

function handleCreateUser() {
  const name = ui.newName.value.trim();
  const team = ui.newTeam.value.trim();
  const role = ui.newRole.value;

  if (!name || !team) {
    alert("Name and team are required.");
    return;
  }

  const user = auth.createProfile({ name, team, role });
  refreshUserSelect(user.id);
  ui.newName.value = "";
  ui.newTeam.value = "";
  ui.newRole.value = "trainee";
  alert("Profile created. Sign in to start training.");
}

function refreshUserSelect(selectedId) {
  const users = auth.listProfiles();
  ui.userSelect.innerHTML = "";

  users.forEach((user) => {
    const option = document.createElement("option");
    option.value = user.id;
    option.textContent = `${user.name} (${formatRole(user.role)} | ${user.team})`;
    ui.userSelect.appendChild(option);
  });

  if (selectedId) {
    ui.userSelect.value = selectedId;
  }
}

function activateTab(tabId) {
  ui.tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabId);
  });

  ui.tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });
}

function renderAll() {
  if (!currentUser) return;

  const requiredModules = store.getModulesForRole(currentUser.role);
  const completionSet = store.getCompletionSet(currentUser.id);
  const completedCount = requiredModules.filter((module) => completionSet.has(module.id)).length;
  const completionPercent = requiredModules.length
    ? Math.round((completedCount / requiredModules.length) * 100)
    : 0;

  ui.welcomeText.textContent = `Welcome, ${currentUser.name}`;
  ui.userMeta.textContent = `${currentUser.team} | ${formatRole(currentUser.role)}`;
  ui.completionPill.textContent = `Completion: ${completionPercent}%`;

  const certCount = store.getCertificationsForUser(currentUser.id).length;
  ui.certPill.textContent = `Certifications: ${certCount}`;

  renderDashboard();
  renderTrainingLibrary();
  renderAssignments();
  renderRecords();

  if (currentUser.role === "supervisor") {
    renderAdmin();
  } else {
    ui.adminTab.innerHTML = "";
  }
}

function renderDashboard() {
  const requiredModules = store.getModulesForRole(currentUser.role);
  const completionSet = store.getCompletionSet(currentUser.id);
  const assignments = store.getAssignmentsForUser(currentUser.id);
  const attempts = store.getAttemptsForUser(currentUser.id);

  const completedCount = requiredModules.filter((module) => completionSet.has(module.id)).length;
  const completionPercent = requiredModules.length
    ? Math.round((completedCount / requiredModules.length) * 100)
    : 0;

  const overdueCount = assignments.filter((assignment) => {
    if (assignment.status === "completed") return false;
    return assignment.dueDate < todayISO();
  }).length;

  const avgScore = attempts.length
    ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length)
    : 0;

  const moduleProgressCards = requiredModules
    .map((module) => {
      const latest = store.getLatestPassedAttempt(currentUser.id, module.id);
      const status = completionSet.has(module.id) ? "Completed" : "Pending";
      const scoreText = latest ? `Passed at ${latest.score}%` : "No passing attempt";

      return `
        <div class="card col-4">
          <h4>${escapeHtml(module.title)}</h4>
          <p class="metric-label">${escapeHtml(status)}</p>
          <p class="note">${escapeHtml(scoreText)}</p>
          <button class="small ghost" data-module-open="${module.id}">Open Module</button>
        </div>
      `;
    })
    .join("");

  const upcomingAssignments = assignments
    .filter((assignment) => assignment.status !== "completed")
    .sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1))
    .slice(0, 4)
    .map((assignment) => {
      const module = store.getModuleById(assignment.moduleId);
      const isOverdue = assignment.dueDate < todayISO();
      return `<li>${escapeHtml(module.title)} - due ${assignment.dueDate}${isOverdue ? " (Overdue)" : ""}</li>`;
    })
    .join("");

  ui.dashboardTab.innerHTML = `
    <div class="grid">
      <div class="card col-4">
        <p class="metric">${requiredModules.length}</p>
        <p class="metric-label">Required Modules</p>
      </div>
      <div class="card col-4">
        <p class="metric">${completedCount}</p>
        <p class="metric-label">Completed Modules</p>
      </div>
      <div class="card col-4">
        <p class="metric">${overdueCount}</p>
        <p class="metric-label">Overdue Assignments</p>
      </div>
      <div class="card col-6">
        <h3>Overall Progress</h3>
        <div class="progress-track">
          <div class="progress-fill" style="width:${completionPercent}%"></div>
        </div>
        <p class="note">${completionPercent}% complete</p>
      </div>
      <div class="card col-6">
        <h3>Average Quiz Score</h3>
        <p class="metric">${avgScore}%</p>
      </div>
      <div class="card col-12">
        <h3>Upcoming Deadlines</h3>
        ${upcomingAssignments ? `<ul>${upcomingAssignments}</ul>` : "<p>No active assignments.</p>"}
      </div>
      ${moduleProgressCards}
    </div>
  `;

  ui.dashboardTab.querySelectorAll("[data-module-open]").forEach((button) => {
    button.addEventListener("click", () => openModuleModal(button.dataset.moduleOpen));
  });
}

function renderTrainingLibrary() {
  const modules = store.getModulesForRole(currentUser.role);
  const completionSet = store.getCompletionSet(currentUser.id);

  ui.trainingTab.innerHTML = `
    <h2>Training Library</h2>
    <p>Open each module, complete the scenario, and pass the quiz to receive certification.</p>
    <div class="grid training-grid" id="trainingGrid"></div>
  `;

  const trainingGrid = ui.trainingTab.querySelector("#trainingGrid");
  const template = document.getElementById("moduleCardTemplate");

  modules.forEach((module) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.querySelector(".module-title").textContent = module.title;
    card.querySelector(".module-desc").textContent = module.description;

    const chipRow = card.querySelector(".chip-row");
    const chips = [
      `${module.category}`,
      `${module.durationMinutes} min`,
      `Pass >= ${module.passScore}%`,
      `Type: ${module.source || "seed"}`,
      completionSet.has(module.id) ? "Completed" : "Pending"
    ];

    chips.forEach((text, index) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      if (index === 4 && text === "Completed") chip.classList.add("good");
      if (index === 4 && text === "Pending") chip.classList.add("warn");
      chip.textContent = text;
      chipRow.appendChild(chip);
    });

    const actions = card.querySelector(".card-actions");
    const openBtn = document.createElement("button");
    openBtn.textContent = completionSet.has(module.id) ? "Review / Retake" : "Start Module";
    openBtn.className = "small";
    openBtn.addEventListener("click", () => openModuleModal(module.id));

    actions.appendChild(openBtn);
    trainingGrid.appendChild(card);
  });
}

function renderAssignments() {
  const assignments = store
    .getAssignmentsForUser(currentUser.id)
    .sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1));

  const template = document.getElementById("assignmentRowTemplate");

  ui.assignmentsTab.innerHTML = `
    <h2>Assignments</h2>
    <table>
      <thead>
        <tr>
          <th>Module</th>
          <th>Due Date</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody id="assignmentTableBody"></tbody>
    </table>
  `;

  const body = ui.assignmentsTab.querySelector("#assignmentTableBody");

  assignments.forEach((assignment) => {
    const row = template.content.firstElementChild.cloneNode(true);
    const module = store.getModuleById(assignment.moduleId);
    if (!module) return;

    const overdue = assignment.status !== "completed" && assignment.dueDate < todayISO();

    row.querySelector(".assign-title").textContent = module.title;
    row.querySelector(".assign-due").textContent = assignment.dueDate;
    row.querySelector(".assign-status").textContent = overdue ? "Overdue" : assignment.status;

    const actionsCell = row.querySelector(".assign-actions");
    const openBtn = document.createElement("button");
    openBtn.className = "small";
    openBtn.textContent = "Open";
    openBtn.addEventListener("click", () => openModuleModal(module.id));

    actionsCell.appendChild(openBtn);
    body.appendChild(row);
  });

  if (!body.children.length) {
    body.innerHTML = "<tr><td colspan=\"4\">No assignments found.</td></tr>";
  }
}

function renderRecords() {
  const attempts = store
    .getAttemptsForUser(currentUser.id)
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  const certs = store.getCertificationsForUser(currentUser.id);

  const attemptRows = attempts
    .map((attempt) => {
      const module = store.getModuleById(attempt.moduleId);
      if (!module) return "";

      return `
      <tr>
        <td>${escapeHtml(module.title)}</td>
        <td>${attempt.score}%</td>
        <td>${attempt.passed ? "Yes" : "No"}</td>
        <td>${attempt.submittedAt.slice(0, 10)}</td>
      </tr>`;
    })
    .join("");

  const certRows = certs
    .map((cert) => {
      const module = store.getModuleById(cert.moduleId);
      if (!module) return "";

      return `
      <tr>
        <td>${escapeHtml(module.title)}</td>
        <td>${cert.issuedAt}</td>
        <td>${cert.expiresAt}</td>
      </tr>`;
    })
    .join("");

  ui.recordsTab.innerHTML = `
    <h2>Training Records</h2>
    <div class="grid">
      <div class="card col-6">
        <h3>Quiz Attempts</h3>
        <table>
          <thead>
            <tr>
              <th>Module</th>
              <th>Score</th>
              <th>Passed</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${attemptRows || "<tr><td colspan=\"4\">No attempts recorded.</td></tr>"}
          </tbody>
        </table>
      </div>
      <div class="card col-6">
        <h3>Certificates</h3>
        <table>
          <thead>
            <tr>
              <th>Module</th>
              <th>Issued</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            ${certRows || "<tr><td colspan=\"3\">No certifications yet.</td></tr>"}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAdmin() {
  const progressRows = store.getUserProgressRows();
  const moduleStats = store.getModuleStats();
  const allUsers = store.getUsers();
  const allModules = store.getAllModules().sort((a, b) => a.title.localeCompare(b.title));

  const traineeUsers = allUsers.filter((user) => user.role === "trainee");

  const progressHtml = progressRows
    .map((row) => {
      return `
        <tr>
          <td>${escapeHtml(row.user.name)}</td>
          <td>${escapeHtml(formatRole(row.user.role))}</td>
          <td>${escapeHtml(row.user.team)}</td>
          <td>${row.completed}/${row.totalRequired}</td>
          <td>
            <div class="progress-track">
              <div class="progress-fill" style="width:${row.percent}%"></div>
            </div>
            <span>${row.percent}%</span>
          </td>
          <td>${row.overdue}</td>
        </tr>
      `;
    })
    .join("");

  const moduleStatsHtml = moduleStats
    .map((stat) => {
      return `
        <tr>
          <td>${escapeHtml(stat.title)}</td>
          <td>${escapeHtml(stat.source || "seed")}</td>
          <td>${stat.attempts}</td>
          <td>${stat.passed}</td>
          <td>${stat.avgScore}%</td>
        </tr>
      `;
    })
    .join("");

  const userOptions = traineeUsers.length
    ? traineeUsers
        .map(
          (user) => `<option value="${user.id}">${escapeHtml(user.name)} (${escapeHtml(user.team)})</option>`
        )
        .join("")
    : '<option value="">No trainee profiles available</option>';

  const moduleEditorOptions = allModules
    .map((module) => {
      const sourceText = module.source === "seed" ? "seed" : "custom";
      return `<option value="${module.id}">${escapeHtml(module.title)} (${sourceText})</option>`;
    })
    .join("");

  ui.adminTab.innerHTML = `
    <h2>Supervisor Console</h2>
    <div class="grid">
      <div class="card col-8">
        <h3>User Progress</h3>
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Team</th>
              <th>Completed</th>
              <th>Progress</th>
              <th>Overdue</th>
            </tr>
          </thead>
          <tbody>
            ${progressHtml}
          </tbody>
        </table>
      </div>
      <div class="card col-4">
        <h3>Assign Training</h3>
        <div class="field">
          <label for="assignUser">Trainee</label>
          <select id="assignUser">${userOptions}</select>
        </div>
        <div class="field">
          <label for="assignModule">Module</label>
          <select id="assignModule"></select>
        </div>
        <div class="field">
          <label for="assignDue">Due Date</label>
          <input id="assignDue" type="date" value="${nextWeek()}" />
        </div>
        <div class="split-actions">
          <button id="assignBtn">Assign</button>
          <button id="exportBtn" class="secondary">Export CSV</button>
        </div>
        <p class="note">CSV includes latest score and certification status by user/module.</p>
      </div>
      <div class="card col-12">
        <h3>Module Performance</h3>
        <table>
          <thead>
            <tr>
              <th>Module</th>
              <th>Type</th>
              <th>Attempts</th>
              <th>Passed</th>
              <th>Average Score</th>
            </tr>
          </thead>
          <tbody>
            ${moduleStatsHtml}
          </tbody>
        </table>
      </div>
      <div class="card col-12">
        <h3>Training Authoring</h3>
        <p class="note">Create or edit modules directly from this console. Seed modules can be edited but not deleted.</p>

        <div class="field">
          <label for="moduleEditorSelect">Load Existing Module</label>
          <select id="moduleEditorSelect">
            <option value="__new">+ Create New Module</option>
            ${moduleEditorOptions}
          </select>
        </div>

        <div class="grid authoring-grid">
          <div class="field col-6">
            <label for="editorTitle">Title</label>
            <input id="editorTitle" type="text" placeholder="Insurance Verification" />
          </div>
          <div class="field col-6">
            <label for="editorCategory">Category</label>
            <input id="editorCategory" type="text" placeholder="Pre-Service" />
          </div>
          <div class="field col-4">
            <label for="editorDuration">Duration (minutes)</label>
            <input id="editorDuration" type="number" min="5" max="240" value="30" />
          </div>
          <div class="field col-4">
            <label for="editorPassScore">Pass Score (%)</label>
            <input id="editorPassScore" type="number" min="50" max="100" value="80" />
          </div>
          <div class="field col-4">
            <label>Required Roles</label>
            <label class="inline-check"><input id="reqTrainee" type="checkbox" checked /> Trainee</label>
            <label class="inline-check"><input id="reqSupervisor" type="checkbox" checked /> Supervisor</label>
          </div>
          <div class="field col-12">
            <label for="editorDescription">Description</label>
            <textarea id="editorDescription" rows="2" placeholder="Describe the process this module covers."></textarea>
          </div>
          <div class="field col-12">
            <label for="editorLessons">Lessons (one line each: Heading || Content)</label>
            <textarea id="editorLessons" rows="4" placeholder="Verification Timing || Re-verify within 24-48 hours.\nCoverage Checks || Confirm deductible and coinsurance."></textarea>
          </div>
          <div class="field col-12">
            <label for="editorQuiz">Quiz (one line each: Prompt || Option1 || Option2 || Option3 || Option4 || Correct Option Number || Rationale)</label>
            <textarea id="editorQuiz" rows="5" placeholder="When should eligibility be rechecked? || At scheduling only || 24-48 hours before service || At billing only || Never || 2 || Coverage can change before service."></textarea>
          </div>
          <div class="field col-6">
            <label for="editorScenarioTitle">Scenario Title</label>
            <input id="editorScenarioTitle" type="text" placeholder="Coverage Discrepancy" />
          </div>
          <div class="field col-6">
            <label for="editorScenarioCorrect">Scenario Correct Option Number</label>
            <input id="editorScenarioCorrect" type="number" min="1" max="10" value="1" />
          </div>
          <div class="field col-12">
            <label for="editorScenarioPrompt">Scenario Prompt</label>
            <textarea id="editorScenarioPrompt" rows="2" placeholder="Describe a realistic pre-service decision point."></textarea>
          </div>
          <div class="field col-12">
            <label for="editorScenarioOptions">Scenario Options (one option per line)</label>
            <textarea id="editorScenarioOptions" rows="4" placeholder="Ignore discrepancy\nEscalate and verify benefits\nCancel visit"></textarea>
          </div>
          <div class="field col-12">
            <label for="editorScenarioExplanation">Scenario Explanation</label>
            <textarea id="editorScenarioExplanation" rows="2" placeholder="Explain why the best response is required."></textarea>
          </div>
        </div>

        <div class="split-actions">
          <button id="newModuleBtn" class="ghost">New Blank Module</button>
          <div class="button-row">
            <button id="saveModuleBtn">Save Module</button>
            <button id="deleteModuleBtn" class="danger">Delete Module</button>
          </div>
        </div>
        <p id="authoringSourceHint" class="note"></p>
      </div>
      <div class="card col-12">
        <h3>System Actions</h3>
        <div class="alert">
          Use reset only to restart demo data for training sessions.
        </div>
        <p></p>
        <button id="resetBtn" class="danger">Reset Demo Data</button>
      </div>
    </div>
  `;

  const assignUserEl = ui.adminTab.querySelector("#assignUser");
  const assignModuleEl = ui.adminTab.querySelector("#assignModule");
  const assignBtn = ui.adminTab.querySelector("#assignBtn");
  const exportBtn = ui.adminTab.querySelector("#exportBtn");
  const resetBtn = ui.adminTab.querySelector("#resetBtn");

  const moduleEditorSelect = ui.adminTab.querySelector("#moduleEditorSelect");
  const editorTitle = ui.adminTab.querySelector("#editorTitle");
  const editorCategory = ui.adminTab.querySelector("#editorCategory");
  const editorDuration = ui.adminTab.querySelector("#editorDuration");
  const editorPassScore = ui.adminTab.querySelector("#editorPassScore");
  const reqTrainee = ui.adminTab.querySelector("#reqTrainee");
  const reqSupervisor = ui.adminTab.querySelector("#reqSupervisor");
  const editorDescription = ui.adminTab.querySelector("#editorDescription");
  const editorLessons = ui.adminTab.querySelector("#editorLessons");
  const editorQuiz = ui.adminTab.querySelector("#editorQuiz");
  const editorScenarioTitle = ui.adminTab.querySelector("#editorScenarioTitle");
  const editorScenarioCorrect = ui.adminTab.querySelector("#editorScenarioCorrect");
  const editorScenarioPrompt = ui.adminTab.querySelector("#editorScenarioPrompt");
  const editorScenarioOptions = ui.adminTab.querySelector("#editorScenarioOptions");
  const editorScenarioExplanation = ui.adminTab.querySelector("#editorScenarioExplanation");
  const authoringSourceHint = ui.adminTab.querySelector("#authoringSourceHint");

  const newModuleBtn = ui.adminTab.querySelector("#newModuleBtn");
  const saveModuleBtn = ui.adminTab.querySelector("#saveModuleBtn");
  const deleteModuleBtn = ui.adminTab.querySelector("#deleteModuleBtn");

  function refreshAssignmentModuleOptions() {
    const selectedUser = allUsers.find((user) => user.id === assignUserEl.value);
    if (!selectedUser) {
      assignModuleEl.innerHTML = '<option value="">No modules</option>';
      return;
    }

    const modules = store.getModulesForRole(selectedUser.role);
    assignModuleEl.innerHTML = modules
      .map((module) => `<option value="${module.id}">${escapeHtml(module.title)}</option>`)
      .join("");
  }

  function fillAuthoringForm(module) {
    if (!module) {
      editorTitle.value = "";
      editorCategory.value = "General";
      editorDuration.value = "30";
      editorPassScore.value = "80";
      reqTrainee.checked = true;
      reqSupervisor.checked = true;
      editorDescription.value = "";
      editorLessons.value = "";
      editorQuiz.value = "";
      editorScenarioTitle.value = "Scenario Drill";
      editorScenarioCorrect.value = "1";
      editorScenarioPrompt.value = "";
      editorScenarioOptions.value = "";
      editorScenarioExplanation.value = "";
      authoringSourceHint.textContent = "Creating a new custom module.";
      deleteModuleBtn.disabled = true;
      return;
    }

    editorTitle.value = module.title;
    editorCategory.value = module.category;
    editorDuration.value = String(module.durationMinutes);
    editorPassScore.value = String(module.passScore);
    reqTrainee.checked = module.requiredFor.includes("trainee");
    reqSupervisor.checked = module.requiredFor.includes("supervisor");
    editorDescription.value = module.description;
    editorLessons.value = serializeLessons(module.lessons);
    editorQuiz.value = serializeQuiz(module.quiz);
    editorScenarioTitle.value = module.scenario.title;
    editorScenarioCorrect.value = String(module.scenario.correctIndex + 1);
    editorScenarioPrompt.value = module.scenario.prompt;
    editorScenarioOptions.value = (module.scenario.options || []).join("\n");
    editorScenarioExplanation.value = module.scenario.explanation;

    const source = module.source || "seed";
    authoringSourceHint.textContent = `Editing module type: ${source}.`;
    deleteModuleBtn.disabled = source === "seed";
  }

  function readAuthoringPayload() {
    const requiredFor = [];
    if (reqTrainee.checked) requiredFor.push("trainee");
    if (reqSupervisor.checked) requiredFor.push("supervisor");

    if (!requiredFor.length) {
      throw new Error("Select at least one required role.");
    }

    const lessons = parseLessons(editorLessons.value);
    const quiz = parseQuiz(editorQuiz.value);

    const scenarioOptions = editorScenarioOptions.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (scenarioOptions.length < 2) {
      throw new Error("Scenario options must include at least two lines.");
    }

    const scenarioCorrect = Number(editorScenarioCorrect.value || 1) - 1;
    if (scenarioCorrect < 0 || scenarioCorrect >= scenarioOptions.length) {
      throw new Error("Scenario correct option number is out of range.");
    }

    return {
      title: editorTitle.value.trim(),
      category: editorCategory.value.trim(),
      description: editorDescription.value.trim(),
      durationMinutes: Number(editorDuration.value || 30),
      passScore: Number(editorPassScore.value || 80),
      requiredFor,
      lessons,
      quiz,
      scenario: {
        title: editorScenarioTitle.value.trim(),
        prompt: editorScenarioPrompt.value.trim(),
        options: scenarioOptions,
        correctIndex: scenarioCorrect,
        explanation: editorScenarioExplanation.value.trim()
      }
    };
  }

  assignUserEl.addEventListener("change", refreshAssignmentModuleOptions);
  refreshAssignmentModuleOptions();

  assignBtn.addEventListener("click", () => {
    const dueDate = ui.adminTab.querySelector("#assignDue").value;
    const userId = assignUserEl.value;
    const moduleId = assignModuleEl.value;

    if (!userId || !moduleId || !dueDate) {
      alert("Select trainee, module, and due date.");
      return;
    }

    const result = store.addAssignment({
      userId,
      moduleId,
      dueDate,
      assignedBy: currentUser.id
    });

    if (!result.ok) {
      alert(result.message);
      return;
    }

    alert("Assignment created.");
    renderAll();
    activateTab("adminTab");
  });

  exportBtn.addEventListener("click", () => {
    const csv = store.exportTrainingCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `financial-clearance-training-${todayISO()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  });

  moduleEditorSelect.addEventListener("change", () => {
    if (moduleEditorSelect.value === "__new") {
      fillAuthoringForm(null);
      return;
    }

    const module = store.getModuleById(moduleEditorSelect.value);
    fillAuthoringForm(module || null);
  });

  newModuleBtn.addEventListener("click", () => {
    moduleEditorSelect.value = "__new";
    fillAuthoringForm(null);
  });

  saveModuleBtn.addEventListener("click", () => {
    let payload;

    try {
      payload = readAuthoringPayload();
    } catch (error) {
      alert(error.message);
      return;
    }

    if (moduleEditorSelect.value === "__new") {
      store.createModule(payload);
      alert("Custom module created.");
      renderAll();
      activateTab("adminTab");
      return;
    }

    const result = store.updateModule(moduleEditorSelect.value, payload);
    if (!result.ok) {
      alert(result.message);
      return;
    }

    alert("Module updated.");
    renderAll();
    activateTab("adminTab");
  });

  deleteModuleBtn.addEventListener("click", () => {
    if (moduleEditorSelect.value === "__new") {
      alert("Select an existing module to delete.");
      return;
    }

    const confirmed = confirm("Delete this module and all related attempts/certifications/assignments?");
    if (!confirmed) return;

    const result = store.deleteModule(moduleEditorSelect.value);
    if (!result.ok) {
      alert(result.message);
      return;
    }

    alert("Module deleted.");
    renderAll();
    activateTab("adminTab");
  });

  resetBtn.addEventListener("click", () => {
    const confirmed = confirm("Reset all app data to seed defaults?");
    if (!confirmed) return;

    store.reset();
    refreshUserSelect(currentUser.id);

    const users = store.getUsers();
    const fallback = users.find((user) => user.role === "supervisor") || users[0];
    currentUser = fallback;
    auth.signIn(fallback.id);
    refreshUserSelect(currentUser.id);
    renderAll();
    activateTab("adminTab");
    alert("Demo data has been reset.");
  });

  fillAuthoringForm(null);
}

function openModuleModal(moduleId) {
  const module = store.getModuleById(moduleId);
  if (!module) {
    alert("Module was not found.");
    return;
  }

  const completionSet = store.getCompletionSet(currentUser.id);
  const isComplete = completionSet.has(module.id);

  const lessonHtml = module.lessons
    .map(
      (lesson) => `
      <article class="card lesson-card">
        <h4>${escapeHtml(lesson.heading)}</h4>
        <p>${escapeHtml(lesson.content)}</p>
      </article>
    `
    )
    .join("");

  const quizHtml = module.quiz
    .map((question, index) => {
      const options = question.options
        .map(
          (option, optionIndex) => `
          <label class="quiz-option">
            <input type="radio" name="q-${index}" value="${optionIndex}" />
            ${escapeHtml(option)}
          </label>
        `
        )
        .join("");

      return `
        <div class="question">
          <h4>${index + 1}. ${escapeHtml(question.prompt)}</h4>
          ${options}
        </div>
      `;
    })
    .join("");

  const scenarioOptions = module.scenario.options
    .map(
      (option, optionIndex) => `
      <label class="quiz-option">
        <input type="radio" name="scenario" value="${optionIndex}" />
        ${escapeHtml(option)}
      </label>
    `
    )
    .join("");

  ui.modalContent.innerHTML = `
    <h2>${escapeHtml(module.title)}</h2>
    <p>${escapeHtml(module.description)}</p>
    <div class="chip-row">
      <span class="chip">${escapeHtml(module.category)}</span>
      <span class="chip">Duration ${module.durationMinutes} minutes</span>
      <span class="chip">Pass >= ${module.passScore}%</span>
      <span class="chip">Type: ${escapeHtml(module.source || "seed")}</span>
      <span class="chip ${isComplete ? "good" : "warn"}">${isComplete ? "Completed" : "Not Completed"}</span>
    </div>
    <hr />
    <h3>Learning Content</h3>
    <div class="grid lesson-grid">
      ${lessonHtml}
    </div>
    <hr />
    <h3>Scenario Drill: ${escapeHtml(module.scenario.title)}</h3>
    <p>${escapeHtml(module.scenario.prompt)}</p>
    <form id="scenarioForm">
      ${scenarioOptions}
      <button type="submit" class="small">Submit Scenario</button>
    </form>
    <div id="scenarioResult" class="note"></div>
    <hr />
    <h3>Knowledge Check</h3>
    <form id="quizForm">
      ${quizHtml}
      <button type="submit">Submit Quiz</button>
    </form>
    <div id="quizResult" class="note"></div>
  `;

  ui.modalOverlay.classList.remove("hidden");

  const scenarioForm = document.getElementById("scenarioForm");
  const quizForm = document.getElementById("quizForm");
  const scenarioResult = document.getElementById("scenarioResult");
  const quizResult = document.getElementById("quizResult");

  scenarioForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = scenarioForm.querySelector("input[name='scenario']:checked");
    if (!selected) {
      alert("Select a scenario response first.");
      return;
    }

    const result = store.submitScenario({
      userId: currentUser.id,
      moduleId,
      selectedIndex: Number(selected.value)
    });

    scenarioResult.innerHTML = result.isCorrect
      ? `<span class="chip good">Correct</span> ${escapeHtml(result.explanation)}`
      : `<span class="chip warn">Needs Review</span> ${escapeHtml(result.explanation)}`;
  });

  quizForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const answers = module.quiz.map((_, index) => {
      const selected = quizForm.querySelector(`input[name='q-${index}']:checked`);
      return selected ? Number(selected.value) : null;
    });

    if (answers.some((answer) => answer === null)) {
      alert("Complete all quiz questions before submitting.");
      return;
    }

    const attempt = store.submitQuizAttempt({
      userId: currentUser.id,
      moduleId,
      answers
    });

    const summary = attempt.passed
      ? `Passed with ${attempt.score}%. Certification issued.`
      : `Scored ${attempt.score}%. Passing score is ${module.passScore}%. Review and retry.`;

    const rationaleList = module.quiz
      .map((question, index) => {
        const wasCorrect = answers[index] === question.correctIndex;
        return `<li>${wasCorrect ? "Correct" : "Incorrect"}: ${escapeHtml(question.rationale)}</li>`;
      })
      .join("");

    quizResult.innerHTML = `
      <div class="alert">
        <strong>${summary}</strong>
        <ul>${rationaleList}</ul>
      </div>
    `;

    renderAll();
  });
}

function closeModal() {
  ui.modalOverlay.classList.add("hidden");
  ui.modalContent.innerHTML = "";
}

function parseLessons(rawValue) {
  const lines = rawValue
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("Add at least one lesson line using 'Heading || Content'.");
  }

  return lines.map((line, index) => {
    const parts = line.split("||").map((part) => part.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      throw new Error(`Lesson line ${index + 1} must use 'Heading || Content'.`);
    }

    return {
      heading: parts[0],
      content: parts.slice(1).join(" || ")
    };
  });
}

function parseQuiz(rawValue) {
  const lines = rawValue
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error(
      "Add at least one quiz line: Prompt || Option1 || Option2 || Option3 || Option4 || Correct Option Number || Rationale"
    );
  }

  return lines.map((line, index) => {
    const parts = line.split("||").map((part) => part.trim());
    if (parts.length < 5) {
      throw new Error(`Quiz line ${index + 1} has too few fields.`);
    }

    const prompt = parts[0];
    const rationale = parts[parts.length - 1] || "Review the policy standard for this item.";
    const correctOptionNumber = Number(parts[parts.length - 2]);
    const options = parts.slice(1, parts.length - 2).filter(Boolean);

    if (!prompt) {
      throw new Error(`Quiz line ${index + 1} is missing prompt text.`);
    }

    if (options.length < 2) {
      throw new Error(`Quiz line ${index + 1} must include at least two answer options.`);
    }

    if (!Number.isFinite(correctOptionNumber)) {
      throw new Error(`Quiz line ${index + 1} has invalid correct option number.`);
    }

    const correctIndex = correctOptionNumber - 1;
    if (correctIndex < 0 || correctIndex >= options.length) {
      throw new Error(`Quiz line ${index + 1} correct option number is out of range.`);
    }

    return {
      id: `q${index + 1}`,
      prompt,
      options,
      correctIndex,
      rationale
    };
  });
}

function serializeLessons(lessons) {
  return (lessons || []).map((lesson) => `${lesson.heading} || ${lesson.content}`).join("\n");
}

function serializeQuiz(quiz) {
  return (quiz || [])
    .map((question) => {
      const correctNumber = question.correctIndex + 1;
      return `${question.prompt} || ${question.options.join(" || ")} || ${correctNumber} || ${question.rationale}`;
    })
    .join("\n");
}

function formatRole(role) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nextWeek() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

init();

