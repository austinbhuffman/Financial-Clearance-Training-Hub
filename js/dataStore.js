const seedData = window.FC_SEED;
const STORAGE_KEY = window.FC_STORAGE_KEY;

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function generateId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

class AppStore {
  constructor() {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) {
      this.data = deepClone(seedData);
      this.persist();
      return;
    }

    try {
      this.data = JSON.parse(existing);
    } catch {
      this.data = deepClone(seedData);
      this.persist();
    }
  }

  persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  reset() {
    this.data = deepClone(seedData);
    this.persist();
  }

  getUsers() {
    return [...this.data.users];
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

  submitQuizAttempt({ userId, moduleId, answers }) {
    const module = this.getModuleById(moduleId);
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

  submitScenario({ userId, moduleId, selectedIndex }) {
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

