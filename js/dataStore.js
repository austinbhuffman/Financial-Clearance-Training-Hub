const seedData = window.FC_SEED;
const STORAGE_KEY = window.FC_STORAGE_KEY;

const ROLE_VALUES = ["trainee", "supervisor"];
const seedModuleIds = new Set((seedData.modules || []).map((module) => module.id));

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function generateId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

class AppStore {
  constructor() {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) {
      this.data = deepClone(seedData);
    } else {
      try {
        this.data = JSON.parse(existing);
      } catch {
        this.data = deepClone(seedData);
      }
    }

    this.ensureDataShape();
    this.persist();
  }

  persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  reset() {
    this.data = deepClone(seedData);
    this.ensureDataShape();
    this.persist();
  }

  ensureDataShape() {
    if (!Array.isArray(this.data.users)) this.data.users = [];
    if (!Array.isArray(this.data.modules)) this.data.modules = [];
    if (!Array.isArray(this.data.assignments)) this.data.assignments = [];
    if (!Array.isArray(this.data.attempts)) this.data.attempts = [];
    if (!Array.isArray(this.data.certifications)) this.data.certifications = [];

    this.data.modules = this.data.modules.map((module) => {
      const source = module.source || (seedModuleIds.has(module.id) ? "seed" : "custom");
      return this.normalizeModule(module, source);
    });
  }

  normalizeRoles(requiredFor) {
    const roles = Array.isArray(requiredFor)
      ? requiredFor.filter((role) => ROLE_VALUES.includes(role))
      : [];
    const deduped = [...new Set(roles)];
    return deduped.length ? deduped : ["trainee"];
  }

  normalizeLessons(lessons) {
    const normalized = Array.isArray(lessons)
      ? lessons
          .map((lesson, index) => {
            const heading = String(lesson?.heading || `Lesson ${index + 1}`).trim();
            const content = String(lesson?.content || "").trim();
            if (!heading || !content) return null;
            return { heading, content };
          })
          .filter(Boolean)
      : [];

    if (normalized.length) return normalized;
    return [{ heading: "Overview", content: "Add lesson content for this training module." }];
  }

  normalizeQuiz(quiz) {
    const normalized = Array.isArray(quiz)
      ? quiz
          .map((question, index) => {
            const prompt = String(question?.prompt || `Question ${index + 1}`).trim();
            let options = Array.isArray(question?.options)
              ? question.options.map((option) => String(option || "").trim()).filter(Boolean)
              : [];

            if (options.length < 2) {
              options = ["Option A", "Option B"];
            }

            const correctIndex = clampNumber(question?.correctIndex, 0, options.length - 1, 0);
            const rationale = String(question?.rationale || "Review this policy step for details.").trim();

            return {
              id: question?.id || `q${index + 1}`,
              prompt: prompt || `Question ${index + 1}`,
              options,
              correctIndex,
              rationale
            };
          })
      : [];

    if (normalized.length) return normalized;

    return [
      {
        id: "q1",
        prompt: "Add the first quiz question.",
        options: ["Option A", "Option B"],
        correctIndex: 0,
        rationale: "Document why this answer is correct for trainees."
      }
    ];
  }

  normalizeScenario(scenario) {
    const options = Array.isArray(scenario?.options)
      ? scenario.options.map((option) => String(option || "").trim()).filter(Boolean)
      : [];

    const safeOptions = options.length >= 2 ? options : ["Action A", "Action B"];

    return {
      title: String(scenario?.title || "Scenario Drill").trim() || "Scenario Drill",
      prompt:
        String(scenario?.prompt || "Add a scenario prompt to test workflow decision-making.").trim() ||
        "Add a scenario prompt to test workflow decision-making.",
      options: safeOptions,
      correctIndex: clampNumber(scenario?.correctIndex, 0, safeOptions.length - 1, 0),
      explanation:
        String(scenario?.explanation || "Add explanation for the best workflow decision.").trim() ||
        "Add explanation for the best workflow decision."
    };
  }

  normalizeModule(module, source) {
    return {
      id: String(module?.id || generateId("m-custom")),
      source,
      title: String(module?.title || "Untitled Module").trim() || "Untitled Module",
      description: String(module?.description || "").trim() || "Add module description.",
      durationMinutes: clampNumber(module?.durationMinutes, 5, 240, 30),
      category: String(module?.category || "General").trim() || "General",
      requiredFor: this.normalizeRoles(module?.requiredFor),
      passScore: clampNumber(module?.passScore, 50, 100, 80),
      lessons: this.normalizeLessons(module?.lessons),
      quiz: this.normalizeQuiz(module?.quiz),
      scenario: this.normalizeScenario(module?.scenario)
    };
  }

  getUsers() {
    return [...this.data.users];
  }

  getAllModules() {
    return [...this.data.modules];
  }

  getModulesForRole(role) {
    return this.data.modules.filter((module) => module.requiredFor.includes(role));
  }

  getModuleById(moduleId) {
    return this.data.modules.find((module) => module.id === moduleId);
  }

  getAssignmentsForUser(userId) {
    return this.data.assignments.filter((assignment) => assignment.userId === userId);
  }

  getAttemptsForUser(userId) {
    return this.data.attempts.filter((attempt) => attempt.userId === userId);
  }

  getLatestPassedAttempt(userId, moduleId) {
    const attempts = this.data.attempts
      .filter((attempt) => attempt.userId === userId && attempt.moduleId === moduleId && attempt.passed)
      .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
    return attempts[0] || null;
  }

  getCompletionSet(userId) {
    const passedIds = new Set(
      this.data.attempts
        .filter((attempt) => attempt.userId === userId && attempt.passed)
        .map((attempt) => attempt.moduleId)
    );

    return passedIds;
  }

  createUser({ name, role, team }) {
    const user = {
      id: generateId("u"),
      name,
      role,
      team,
      createdAt: todayISO()
    };
    this.data.users.push(user);

    if (role === "trainee") {
      const defaultModules = this.getModulesForRole("trainee").map((module) => module.id);
      defaultModules.forEach((moduleId, index) => {
        this.data.assignments.push({
          id: generateId("a"),
          userId: user.id,
          moduleId,
          dueDate: this.addDays(index * 3 + 7),
          assignedBy: "system",
          status: "assigned"
        });
      });
    }

    this.persist();
    return user;
  }

  addAssignment({ userId, moduleId, dueDate, assignedBy }) {
    const module = this.getModuleById(moduleId);
    if (!module) {
      return { ok: false, message: "Selected module was not found." };
    }

    const exists = this.data.assignments.some(
      (assignment) => assignment.userId === userId && assignment.moduleId === moduleId
    );

    if (exists) {
      return { ok: false, message: "Assignment already exists for this user and module." };
    }

    const assignment = {
      id: generateId("a"),
      userId,
      moduleId,
      dueDate,
      assignedBy,
      status: "assigned"
    };

    this.data.assignments.push(assignment);
    this.persist();
    return { ok: true, assignment };
  }

  createModule(payload) {
    const module = this.normalizeModule(
      {
        ...payload,
        id: generateId("m-custom"),
        source: "custom"
      },
      "custom"
    );

    this.data.modules.push(module);
    this.persist();
    return module;
  }

  updateModule(moduleId, payload) {
    const index = this.data.modules.findIndex((module) => module.id === moduleId);
    if (index < 0) {
      return { ok: false, message: "Module not found." };
    }

    const existing = this.data.modules[index];
    const source = existing.source || (seedModuleIds.has(existing.id) ? "seed" : "custom");

    const module = this.normalizeModule(
      {
        ...existing,
        ...payload,
        id: existing.id,
        source
      },
      source
    );

    this.data.modules[index] = module;
    this.persist();
    return { ok: true, module };
  }

  deleteModule(moduleId) {
    const index = this.data.modules.findIndex((module) => module.id === moduleId);
    if (index < 0) {
      return { ok: false, message: "Module not found." };
    }

    const module = this.data.modules[index];
    if (module.source === "seed") {
      return {
        ok: false,
        message: "Seed modules are protected from deletion. You can edit them, but only custom modules can be deleted."
      };
    }

    this.data.modules.splice(index, 1);
    this.data.assignments = this.data.assignments.filter((assignment) => assignment.moduleId !== moduleId);
    this.data.attempts = this.data.attempts.filter((attempt) => attempt.moduleId !== moduleId);
    this.data.certifications = this.data.certifications.filter((cert) => cert.moduleId !== moduleId);
    this.persist();

    return { ok: true };
  }

  submitQuizAttempt({ userId, moduleId, answers }) {
    const module = this.getModuleById(moduleId);
    if (!module) {
      throw new Error("Module not found.");
    }

    const total = module.quiz.length;
    const correct = module.quiz.reduce(
      (count, question, index) => (answers[index] === question.correctIndex ? count + 1 : count),
      0
    );

    const score = Math.round((correct / total) * 100);
    const passed = score >= module.passScore;

    const attempt = {
      id: generateId("t"),
      userId,
      moduleId,
      answers,
      score,
      passed,
      submittedAt: new Date().toISOString()
    };

    this.data.attempts.push(attempt);

    if (passed) {
      const assignment = this.data.assignments.find(
        (item) => item.userId === userId && item.moduleId === moduleId
      );
      if (assignment) {
        assignment.status = "completed";
      }

      const existingCert = this.data.certifications.find(
        (cert) => cert.userId === userId && cert.moduleId === moduleId
      );

      if (!existingCert) {
        this.data.certifications.push({
          id: generateId("c"),
          userId,
          moduleId,
          issuedAt: todayISO(),
          expiresAt: this.addDays(365)
        });
      }
    }

    this.persist();
    return attempt;
  }

  submitScenario({ moduleId, selectedIndex }) {
    const module = this.getModuleById(moduleId);
    const isCorrect = module.scenario.correctIndex === selectedIndex;
    return {
      isCorrect,
      explanation: module.scenario.explanation
    };
  }

  getCertificationsForUser(userId) {
    return this.data.certifications.filter((cert) => cert.userId === userId);
  }

  getModuleStats() {
    return this.data.modules.map((module) => {
      const attempts = this.data.attempts.filter((attempt) => attempt.moduleId === module.id);
      const passed = attempts.filter((attempt) => attempt.passed);
      const avgScore = attempts.length
        ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length)
        : 0;

      return {
        moduleId: module.id,
        title: module.title,
        source: module.source,
        attempts: attempts.length,
        passed: passed.length,
        avgScore
      };
    });
  }

  getUserProgressRows() {
    return this.data.users.map((user) => {
      const moduleIds = this.getModulesForRole(user.role).map((module) => module.id);
      const completedSet = this.getCompletionSet(user.id);
      const completed = moduleIds.filter((moduleId) => completedSet.has(moduleId)).length;
      const percent = moduleIds.length ? Math.round((completed / moduleIds.length) * 100) : 0;

      const overdue = this.data.assignments.filter((assignment) => {
        if (assignment.userId !== user.id) return false;
        if (assignment.status === "completed") return false;
        return assignment.dueDate < todayISO();
      }).length;

      return {
        user,
        totalRequired: moduleIds.length,
        completed,
        percent,
        overdue
      };
    });
  }

  exportTrainingCsv() {
    const header = [
      "User Name",
      "Role",
      "Team",
      "Module",
      "Module Source",
      "Latest Score",
      "Passed",
      "Completion Date",
      "Certificate Expiration"
    ];

    const rows = [];

    this.data.users.forEach((user) => {
      const modules = this.getModulesForRole(user.role);
      modules.forEach((module) => {
        const latest = this.data.attempts
          .filter((attempt) => attempt.userId === user.id && attempt.moduleId === module.id)
          .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))[0];

        const cert = this.data.certifications.find(
          (item) => item.userId === user.id && item.moduleId === module.id
        );

        rows.push([
          user.name,
          user.role,
          user.team,
          module.title,
          module.source || "seed",
          latest ? latest.score : "",
          latest ? (latest.passed ? "Yes" : "No") : "",
          latest ? latest.submittedAt.slice(0, 10) : "",
          cert ? cert.expiresAt : ""
        ]);
      });
    });

    const toCsvLine = (line) =>
      line
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(",");

    return [header, ...rows].map(toCsvLine).join("\n");
  }

  addDays(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }
}

window.AppStore = AppStore;
