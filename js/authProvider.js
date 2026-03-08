const LOCAL_AUTH_SESSION_KEY = "fc_local_auth_session_v1";
const API_AUTH_SESSION_KEY = "fc_api_auth_session_v1";

function randomToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function deriveLocalEmail(user) {
  const explicit = String(user?.email || "").trim().toLowerCase();
  if (explicit) return explicit;

  const base = String(user?.name || user?.id || "user")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 28);

  return `${base || "user"}@local.training`;
}

class LocalProfileAuth {
  constructor(store) {
    this.store = store;
    this.current = null;
    this.pendingChallenges = new Map();
    this.passwordMap = this.loadPasswordMap();
  }

  loadPasswordMap() {
    const map = {};
    const users = this.store.getUsers();

    users.forEach((user) => {
      const email = deriveLocalEmail(user);
      map[email] = map[email] || {
        userId: user.id,
        password: "TempPass123!",
        mustChangePassword: true
      };
    });

    return map;
  }

  persistSession() {
    if (!this.current) {
      localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
      return;
    }

    localStorage.setItem(
      LOCAL_AUTH_SESSION_KEY,
      JSON.stringify({
        id: this.current.id,
        email: this.current.email,
        role: this.current.role,
        team: this.current.team,
        name: this.current.name
      })
    );
  }

  listProfiles() {
    return this.store.getUsers().map((user) => ({ ...user, email: deriveLocalEmail(user) }));
  }

  async signInWithPassword(email, password) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const record = this.passwordMap[normalizedEmail];
    if (!record) {
      throw new Error("No account found for this email in local mode.");
    }

    if (record.password !== password) {
      throw new Error("Invalid password.");
    }

    if (record.mustChangePassword) {
      const challengeToken = randomToken();
      this.pendingChallenges.set(challengeToken, normalizedEmail);
      return {
        challenge: "NEW_PASSWORD_REQUIRED",
        challengeToken,
        email: normalizedEmail
      };
    }

    const user = this.store.getUsers().find((entry) => entry.id === record.userId);
    if (!user) {
      throw new Error("User profile no longer exists.");
    }

    this.current = { ...user, email: normalizedEmail };
    this.persistSession();
    return { user: this.current };
  }

  async completeNewPassword(challengeToken, newPassword) {
    const email = this.pendingChallenges.get(challengeToken);
    if (!email) {
      throw new Error("Password challenge expired. Sign in again.");
    }

    const record = this.passwordMap[email];
    if (!record) {
      throw new Error("User record was not found.");
    }

    record.password = newPassword;
    record.mustChangePassword = false;
    this.pendingChallenges.delete(challengeToken);

    const user = this.store.getUsers().find((entry) => entry.id === record.userId);
    if (!user) throw new Error("User profile no longer exists.");

    this.current = { ...user, email };
    this.persistSession();
    return { user: this.current };
  }

  async getCurrentUser() {
    if (this.current) return this.current;

    const raw = localStorage.getItem(LOCAL_AUTH_SESSION_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      this.current = parsed;
      return parsed;
    } catch {
      localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
      return null;
    }
  }

  async signOut() {
    this.current = null;
    localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
  }

  async inviteUser(payload, actor) {
    if (actor?.role !== "supervisor") {
      throw new Error("Only supervisors can invite users.");
    }

    const email = String(payload?.email || "").trim().toLowerCase();
    if (!email) throw new Error("Invite email is required.");

    if (this.passwordMap[email]) {
      throw new Error("A local user with this email already exists.");
    }

    const user = this.store.createUser({
      name: String(payload?.name || email.split("@")[0]).trim(),
      team: String(payload?.team || "General").trim(),
      role: payload?.role === "supervisor" ? "supervisor" : "trainee"
    });

    user.email = email;
    this.passwordMap[email] = {
      userId: user.id,
      password: "TempPass123!",
      mustChangePassword: true
    };

    this.store.persist();

    return {
      ok: true,
      mode: "local",
      email,
      temporaryPassword: "TempPass123!",
      message: "Local mode invite created. Share temporary password manually."
    };
  }

  canInviteUsers() {
    return true;
  }

  describeMode() {
    return "Local demo auth mode is active. For production, switch to API mode for managed email invites and password policies.";
  }
}

class ApiEmailAuth {
  constructor() {
    this.baseUrl = String(window.FC_AUTH_API_BASE || "http://localhost:8080").replace(/\/+$/, "");
  }

  getToken() {
    return localStorage.getItem(API_AUTH_SESSION_KEY);
  }

  setToken(token) {
    if (!token) {
      localStorage.removeItem(API_AUTH_SESSION_KEY);
      return;
    }

    localStorage.setItem(API_AUTH_SESSION_KEY, token);
  }

  async request(path, { method = "GET", body, token } = {}) {
    const headers = {
      Accept: "application/json"
    };

    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });

    const rawText = await response.text();
    let payload = {};

    if (rawText) {
      try {
        payload = JSON.parse(rawText);
      } catch {
        payload = { message: rawText };
      }
    }

    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Request failed (${response.status})`);
    }

    return payload;
  }

  async signInWithPassword(email, password) {
    const payload = await this.request("/auth/login", {
      method: "POST",
      body: { email, password }
    });

    if (payload.challenge === "NEW_PASSWORD_REQUIRED") {
      return {
        challenge: payload.challenge,
        challengeToken: payload.challengeToken,
        email: payload.email || email
      };
    }

    if (!payload.token || !payload.user) {
      throw new Error("Unexpected login response from authentication service.");
    }

    this.setToken(payload.token);
    return { user: payload.user };
  }

  async completeNewPassword(challengeToken, newPassword) {
    const payload = await this.request("/auth/challenge/new-password", {
      method: "POST",
      body: { challengeToken, newPassword }
    });

    if (!payload.token || !payload.user) {
      throw new Error("Unexpected password challenge response from authentication service.");
    }

    this.setToken(payload.token);
    return { user: payload.user };
  }

  async getCurrentUser() {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload = await this.request("/auth/me", { token });
      return payload.user || null;
    } catch {
      this.setToken(null);
      return null;
    }
  }

  async signOut() {
    this.setToken(null);
  }

  async inviteUser(payload) {
    const token = this.getToken();
    if (!token) throw new Error("Not signed in.");

    return this.request("/admin/users/invite", {
      method: "POST",
      token,
      body: payload
    });
  }

  canInviteUsers() {
    return true;
  }

  describeMode() {
    return `Email/password authentication is active via API (${this.baseUrl}).`;
  }
}

class SsoStubAuth {
  isAvailable() {
    return false;
  }

  getSetupMessage() {
    return "SSO stub only: wire OAuth/OIDC redirect endpoints when moving to enterprise single sign-on.";
  }
}

function createAuthProvider(store) {
  const mode = String(window.FC_AUTH_MODE || "api").toLowerCase();
  if (mode === "local") return new LocalProfileAuth(store);
  return new ApiEmailAuth();
}

window.LocalProfileAuth = LocalProfileAuth;
window.SsoStubAuth = SsoStubAuth;
window.createAuthProvider = createAuthProvider;

