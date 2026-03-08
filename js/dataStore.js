const seedData = window.FC_SEED;
const STORAGE_KEY = window.FC_STORAGE_KEY;

const ROLE_VALUES = ["trainee", "supervisor"];
const EVIDENCE_VALUES = ["none", "note", "upload", "trainer_signoff"];
const ASSIGNMENT_STATUSES = [
  "not_started",
  "in_progress",
  "steps_complete",
  "completed",
  "failed"
];
const seedModuleIds = new Set((seedData.modules || []).map((module) => module.id));

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nowISO() {
  return new Date().toISOString();
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
    if (!Array.isArray(this.data.stepCompletions)) this.data.stepCompletions = [];

    this.data.modules = this.data.modules.map((module) => {
      const source = module.source || (seedModuleIds.has(module.id) ? "seed" : "custom");
      return this.normalizeModule(module, source);
    });

    this.data.assignments = this.data.assignments.map((assignment) =>
      this.normalizeAssignment(assignment)
    );

    this.data.stepCompletions = this.data.stepCompletions.map((completion) =>
      this.normalizeStepCompletion(completion)
    );
  }

  normalizeRoles(requiredFor) {
    const roles = Array.isArray(requiredFor)
      ? requiredFor.filter((role) => ROLE_VALUES.includes(role))
      : [];

    const deduped = [...new Set(roles)];
    return deduped.length ? deduped : ["trainee"];
  }

  normalizeEvidenceRequired(value) {
    if (typeof value !== "string") return "none";
    return EVIDENCE_VALUES.includes(value) ? value : "none";
  }

  normalizeLessons(lessons) {
    const normalized = Array.isArray(lessons)
      ? lessons
          .map((lesson, index) => {
            const heading = String(lesson?.heading || lesson?.step_title || `Lesson ${index + 1}`).trim();
            const content = String(
              lesson?.content || lesson?.step_instructions || lesson?.stepInstructions || ""
            ).trim();

            if (!heading || !content) return null;

            return {
              heading,
              content,
              evidenceRequired: this.normalizeEvidenceRequired(
                lesson?.evidenceRequired || lesson?.evidence_required || "none"
              )
            };
          })
          .filter(Boolean)
      : [];

    if (normalized.length) return normalized;

    return [
      {
        heading: "Overview",
        content: "Add lesson content for this training module.",
        evidenceRequired: "none"
      }
    ];
  }

  normalizeSteps(steps, lessons) {
    const source = Array.isArray(steps) && steps.length
      ? steps
      : this.normalizeLessons(lessons).map((lesson, index) => ({
          id: `s${index + 1}`,
          stepNumber: index + 1,
          stepTitle: lesson.heading,
          stepInstructions: lesson.content,
          evidenceRequired: lesson.evidenceRequired || "none"
        }));

    const normalized = source
      .map((step, index) => {
        const stepNumber = clampNumber(
          step?.stepNumber ?? step?.step_number ?? index + 1,
          1,
          999,
          index + 1
        );

        const stepTitle = String(
          step?.stepTitle || step?.step_title || step?.heading || `Step ${stepNumber}`
        ).trim();

        const stepInstructions = String(
          step?.stepInstructions || step?.step_instructions || step?.content || ""
        ).trim();

        if (!stepTitle || !stepInstructions) return null;

        return {
          id: String(step?.id || `s${stepNumber}`),
          stepNumber,
          stepTitle,
          stepInstructions,
          evidenceRequired: this.normalizeEvidenceRequired(
            step?.evidenceRequired || step?.evidence_required || "none"
          )
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .map((step, index) => ({
        ...step,
        stepNumber: index + 1,
        id: step.id || `s${index + 1}`
      }));

    return normalized.length
      ? normalized
      : [
          {
            id: "s1",
            stepNumber: 1,
            stepTitle: "Overview",
            stepInstructions: "Add step instructions for this module.",
            evidenceRequired: "none"
          }
        ];
  }

  normalizeQuiz(quiz) {
    const normalized = Array.isArray(quiz)
      ? quiz
          .map((question, index) => {
            const prompt = String(question?.prompt || question?.question || `Question ${index + 1}`).trim();
            let options = Array.isArray(question?.options)
              ? question.options.map((option) => String(option || "").trim()).filter(Boolean)
              : [];

            if (options.length < 2) {
              options = ["Option A", "Option B"];
            }

            const correctIndex = clampNumber(
              question?.correctIndex ?? question?.correct_answer_index,
              0,
              options.length - 1,
              0
            );

            const rationale = String(
              question?.rationale || "Review this policy step for details."
            ).trim();

            return {
              id: question?.id || `q${index + 1}`,
              prompt: prompt || `Question ${index + 1}`,
              options,
              correctIndex,
              rationale,
              order: clampNumber(question?.order ?? index + 1, 1, 999, index + 1)
            };
          })
      : [];

    if (normalized.length) {
      return normalized.sort((a, b) => a.order - b.order);
    }

    return [
      {
        id: "q1",
        prompt: "Add the first quiz question.",
        options: ["Option A", "Option B"],
        correctIndex: 0,
        rationale: "Document why this answer is correct for trainees.",
        order: 1
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
    const steps = this.normalizeSteps(module?.steps, module?.lessons);

    return {
      id: String(module?.id || generateId("m-custom")),
      source,
      title: String(module?.title || "Untitled Module").trim() || "Untitled Module",
      description: String(module?.description || "").trim() || "Add module description.",
      durationMinutes: clampNumber(module?.durationMinutes || module?.estimated_minutes, 5, 240, 30),
      category: String(module?.category || "General").trim() || "General",
      requiredFor: this.normalizeRoles(module?.requiredFor),
      passScore: clampNumber(module?.passScore, 50, 100, 80),
      lessons: steps.map((step) => ({
        heading: step.stepTitle,
        content: step.stepInstructions,
        evidenceRequired: step.evidenceRequired
      })),
      steps,
      quiz: this.normalizeQuiz(module?.quiz),
      scenario: this.normalizeScenario(module?.scenario)
    };
  }

  normalizeAssignment(assignment) {
    let status = assignment?.status || "not_started";
    if (status === "assigned") status = "not_started";
    if (!ASSIGNMENT_STATUSES.includes(status)) status = "not_started";

    return {
      ...assignment,
      id: String(assignment?.id || generateId("a")),
      userId: assignment?.userId || assignment?.trainee_id,
      moduleId: assignment?.moduleId || assignment?.lesson_id || assignment?.training_id,
      dueDate: assignment?.dueDate || assignment?.due_date || this.addDays(14),
      assignedBy: assignment?.assignedBy || assignment?.assigned_by || "system",
      status,
      scenarioScore: assignment?.scenarioScore ?? assignment?.scenario_score ?? null,
      scenarioPassed: assignment?.scenarioPassed ?? assignment?.scenario_passed ?? null,
      completedDate: assignment?.completedDate || assignment?.completed_date || null
    };
  }

  normalizeStepCompletion(completion) {
    return {
      ...completion,
      id: String(completion?.id || generateId("sc")),
      assignmentId: completion?.assignmentId || completion?.assignment_id,
      stepId: completion?.stepId || completion?.step_id,
      userId: completion?.userId || completion?.trainee_id || null,
      completed: Boolean(completion?.completed),
      completedAt: completion?.completedAt || completion?.completed_datetime || null,
      evidenceNote: completion?.evidenceNote || completion?.evidence_note || null,
      evidenceUpload: completion?.evidenceUpload || completion?.evidence_upload || null,
      trainerVerified: Boolean(completion?.trainerVerified || completion?.trainer_verified),
      trainerVerifiedAt: completion?.trainerVerifiedAt || completion?.trainer_verified_datetime || null,
      trainerVerifiedBy: completion?.trainerVerifiedBy || completion?.trainer_verified_by || null
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

  getModuleSteps(moduleId) {
    const module = this.getModuleById(moduleId);
    return module ? [...(module.steps || [])].sort((a, b) => a.stepNumber - b.stepNumber) : [];
  }

  getAssignmentsForUser(userId) {
    return this.data.assignments.filter((assignment) => assignment.userId === userId);
  }

  getAssignmentById(assignmentId) {
    return this.data.assignments.find((assignment) => assignment.id === assignmentId);
  }

  getAssignmentByUserModule(userId, moduleId) {
    return this.data.assignments.find(
      (assignment) => assignment.userId === userId && assignment.moduleId === moduleId
    );
  }

  ensureAssignmentForModule(userId, moduleId, assignedBy = "system") {
    let assignment = this.getAssignmentByUserModule(userId, moduleId);
    if (!assignment) {
      assignment = {
        id: generateId("a"),
        userId,
        moduleId,
        dueDate: this.addDays(14),
        assignedBy,
        status: "not_started",
        scenarioScore: null,
        scenarioPassed: null,
        completedDate: null
      };
      this.data.assignments.push(assignment);
      this.persist();
    }

    return assignment;
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

  getStepCompletions(assignmentId) {
    return this.data.stepCompletions.filter((completion) => completion.assignmentId === assignmentId);
  }

  getStepCompletion(assignmentId, stepId) {
    return this.data.stepCompletions.find(
      (completion) => completion.assignmentId === assignmentId && completion.stepId === stepId
    );
  }

  isStepCompleted(step, completion) {
    if (!completion || !completion.completed) return false;
    if (step.evidenceRequired === "trainer_signoff") {
      return Boolean(completion.trainerVerified);
    }
    return true;
  }

  getLessonPlayerState(userId, moduleId) {
    const module = this.getModuleById(moduleId);
    if (!module) return null;

    const assignment = this.ensureAssignmentForModule(userId, moduleId, "system");
    const steps = this.getModuleSteps(moduleId);
    const completions = this.getStepCompletions(assignment.id);

    const firstIncompleteIndex = steps.findIndex((step) => {
      const completion = completions.find((item) => item.stepId === step.id);
      return !this.isStepCompleted(step, completion);
    });

    const completedCount = steps.filter((step) => {
      const completion = completions.find((item) => item.stepId === step.id);
      return this.isStepCompleted(step, completion);
    }).length;

    const allStepsDone = steps.length > 0 && completedCount === steps.length;

    if (assignment.status === "not_started" && completions.length) {
      assignment.status = "in_progress";
      this.persist();
    }

    return {
      assignment,
      steps,
      completions,
      firstIncompleteIndex: firstIncompleteIndex === -1 ? Math.max(0, steps.length - 1) : firstIncompleteIndex,
      completedCount,
      allStepsDone,
      progressPercent: steps.length ? Math.round((completedCount / steps.length) * 100) : 0
    };
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
          status: "not_started",
          scenarioScore: null,
          scenarioPassed: null,
          completedDate: null
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
      status: "not_started",
      scenarioScore: null,
      scenarioPassed: null,
      completedDate: null
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

    const removedAssignmentIds = this.data.assignments
      .filter((assignment) => assignment.moduleId === moduleId)
      .map((assignment) => assignment.id);

    this.data.modules.splice(index, 1);
    this.data.assignments = this.data.assignments.filter((assignment) => assignment.moduleId !== moduleId);
    this.data.attempts = this.data.attempts.filter((attempt) => attempt.moduleId !== moduleId);
    this.data.certifications = this.data.certifications.filter((cert) => cert.moduleId !== moduleId);
    this.data.stepCompletions = this.data.stepCompletions.filter(
      (completion) => !removedAssignmentIds.includes(completion.assignmentId)
    );

    this.persist();
    return { ok: true };
  }

  submitStepCompletion({ assignmentId, stepId, evidenceNote, evidenceUpload, userId }) {
    const assignment = this.getAssignmentById(assignmentId);
    if (!assignment) {
      return { ok: false, message: "Assignment not found." };
    }

    const steps = this.getModuleSteps(assignment.moduleId);
    const step = steps.find((item) => item.id === stepId);
    if (!step) {
      return { ok: false, message: "Step not found." };
    }

    const existing = this.getStepCompletion(assignmentId, stepId);

    const payload = {
      id: existing ? existing.id : generateId("sc"),
      assignmentId,
      stepId,
      userId: userId || assignment.userId,
      completed: step.evidenceRequired !== "trainer_signoff",
      completedAt: nowISO(),
      evidenceNote: evidenceNote || existing?.evidenceNote || null,
      evidenceUpload: evidenceUpload || existing?.evidenceUpload || null,
      trainerVerified: existing?.trainerVerified || false,
      trainerVerifiedAt: existing?.trainerVerifiedAt || null,
      trainerVerifiedBy: existing?.trainerVerifiedBy || null
    };

    if (step.evidenceRequired === "upload" && !payload.evidenceUpload) {
      return { ok: false, message: "This step requires an upload reference." };
    }

    if (existing) {
      const index = this.data.stepCompletions.findIndex((item) => item.id === existing.id);
      this.data.stepCompletions[index] = payload;
    } else {
      this.data.stepCompletions.push(payload);
    }

    this.recomputeAssignmentStatusById(assignmentId);
    this.persist();

    return { ok: true, completion: payload };
  }

  verifyStepCompletion({ completionId, trainerId }) {
    const index = this.data.stepCompletions.findIndex((completion) => completion.id === completionId);
    if (index < 0) {
      return { ok: false, message: "Step completion not found." };
    }

    const completion = this.data.stepCompletions[index];
    const assignment = this.getAssignmentById(completion.assignmentId);
    if (!assignment) {
      return { ok: false, message: "Assignment not found for this completion." };
    }

    const step = this.getModuleSteps(assignment.moduleId).find((item) => item.id === completion.stepId);
    if (!step || step.evidenceRequired !== "trainer_signoff") {
      return { ok: false, message: "This step does not require trainer verification." };
    }

    this.data.stepCompletions[index] = {
      ...completion,
      completed: true,
      trainerVerified: true,
      trainerVerifiedBy: trainerId || null,
      trainerVerifiedAt: nowISO(),
      completedAt: completion.completedAt || nowISO()
    };

    this.recomputeAssignmentStatusById(assignment.id);
    this.persist();

    return { ok: true, completion: this.data.stepCompletions[index] };
  }

  getPendingTrainerVerifications() {
    return this.data.stepCompletions
      .filter((completion) => completion.completed && !completion.trainerVerified)
      .map((completion) => {
        const assignment = this.getAssignmentById(completion.assignmentId);
        if (!assignment) return null;

        const step = this.getModuleSteps(assignment.moduleId).find((item) => item.id === completion.stepId);
        if (!step || step.evidenceRequired !== "trainer_signoff") return null;

        const user = this.data.users.find((item) => item.id === assignment.userId);
        const module = this.getModuleById(assignment.moduleId);

        return {
          completionId: completion.id,
          assignmentId: assignment.id,
          stepId: step.id,
          stepTitle: step.stepTitle,
          evidenceNote: completion.evidenceNote,
          evidenceUpload: completion.evidenceUpload,
          submittedAt: completion.completedAt,
          traineeId: assignment.userId,
          traineeName: user ? user.name : "Unknown",
          moduleId: assignment.moduleId,
          moduleTitle: module ? module.title : "Unknown"
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  }

  recomputeAssignmentStatusById(assignmentId) {
    const assignment = this.getAssignmentById(assignmentId);
    if (!assignment) return;

    const steps = this.getModuleSteps(assignment.moduleId);
    const completions = this.getStepCompletions(assignment.id);

    if (!completions.length) {
      if (assignment.status !== "completed" && assignment.status !== "failed") {
        assignment.status = "not_started";
      }
      return;
    }

    const allDone = steps.every((step) => {
      const completion = completions.find((item) => item.stepId === step.id);
      return this.isStepCompleted(step, completion);
    });

    if (allDone) {
      if (assignment.status !== "completed") {
        assignment.status = "steps_complete";
      }
    } else {
      if (assignment.status !== "completed") {
        assignment.status = "in_progress";
      }
    }
  }

  submitQuizAttempt({ userId, moduleId, answers }) {
    const module = this.getModuleById(moduleId);
    if (!module) {
      throw new Error("Module not found.");
    }

    const assignment = this.ensureAssignmentForModule(userId, moduleId, "system");
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
      submittedAt: nowISO()
    };

    this.data.attempts.push(attempt);

    if (passed) {
      assignment.status = "completed";
      assignment.completedDate = todayISO();

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
    } else {
      if (assignment.status === "steps_complete") {
        assignment.status = "failed";
      } else if (assignment.status === "not_started") {
        assignment.status = "in_progress";
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
      "Assignment Status",
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

        const assignment = this.getAssignmentByUserModule(user.id, module.id);

        rows.push([
          user.name,
          user.role,
          user.team,
          module.title,
          module.source || "seed",
          assignment ? assignment.status : "",
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
