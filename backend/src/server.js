const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { URL } = require("url");

let CognitoIdentityProviderClient;
let AdminCreateUserCommand;
let InitiateAuthCommand;
let RespondToAuthChallengeCommand;

try {
  ({
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    InitiateAuthCommand,
    RespondToAuthChallengeCommand
  } = require("@aws-sdk/client-cognito-identity-provider"));
} catch {
  // Optional dependency for AUTH_MODE=cognito.
}

function loadDotEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const eqIndex = line.indexOf("=");
      if (eqIndex <= 0) return;

      const key = line.slice(0, eqIndex).trim();
      const value = line.slice(eqIndex + 1).trim();
      if (!key || process.env[key] !== undefined) return;

      process.env[key] = value;
    });
}

loadDotEnvFile();

const port = Number(process.env.PORT || 8080);
const authMode = String(process.env.AUTH_MODE || "mock").toLowerCase();
const sessionTtlMs = Number(process.env.SESSION_TTL_MS || 12 * 60 * 60 * 1000);

const sessions = new Map();
const challenges = new Map();
const mockUsers = new Map();

function randomToken(size = 24) {
  return crypto.randomBytes(size).toString("hex");
}

function now() {
  return Date.now();
}

function cleanExpiredSessions() {
  const current = now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= current) sessions.delete(token);
  }
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function parseAuthorization(req) {
  const raw = req.headers.authorization || "";
  if (!raw.toLowerCase().startsWith("bearer ")) return null;
  return raw.slice(7).trim();
}

function getSessionUser(req) {
  cleanExpiredSessions();
  const token = parseAuthorization(req);
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  return session.user;
}

function createSession(user) {
  const token = randomToken(20);
  sessions.set(token, {
    token,
    user,
    issuedAt: now(),
    expiresAt: now() + sessionTtlMs
  });
  return token;
}

function sanitizeUser(user) {
  return {
    id: String(user.id || user.email),
    email: String(user.email || "").toLowerCase(),
    name: String(user.name || user.email || "User"),
    team: String(user.team || "Unassigned"),
    role: user.role === "supervisor" ? "supervisor" : "trainee"
  };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

function generateTempPassword() {
  const base = randomToken(6);
  return `Tmp-${base.slice(0, 4)}!${base.slice(4, 8)}A`;
}

function parseJwtPayload(jwt) {
  const parts = String(jwt || "").split(".");
  if (parts.length < 2) return {};

  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

function ensureMockUsers() {
  if (mockUsers.size) return;

  const supervisorEmail = String(
    process.env.BOOTSTRAP_SUPERVISOR_EMAIL || "supervisor@financialclearance.local"
  )
    .trim()
    .toLowerCase();

  const supervisor = {
    id: "u-supervisor-1",
    email: supervisorEmail,
    name: process.env.BOOTSTRAP_SUPERVISOR_NAME || "Financial Clearance Supervisor",
    team: process.env.BOOTSTRAP_SUPERVISOR_TEAM || "Leadership",
    role: "supervisor",
    password: process.env.BOOTSTRAP_SUPERVISOR_TEMP_PASSWORD || "TempPass123!",
    forceChangePassword: true
  };

  const trainee = {
    id: "u-trainee-1",
    email: String(process.env.BOOTSTRAP_TRAINEE_EMAIL || "trainee@financialclearance.local").toLowerCase(),
    name: process.env.BOOTSTRAP_TRAINEE_NAME || "New Trainee",
    team: process.env.BOOTSTRAP_TRAINEE_TEAM || "Patient Access",
    role: "trainee",
    password: process.env.BOOTSTRAP_TRAINEE_TEMP_PASSWORD || "TempPass123!",
    forceChangePassword: true
  };

  mockUsers.set(supervisor.email, supervisor);
  mockUsers.set(trainee.email, trainee);
}

function assertCognitoReady() {
  if (!CognitoIdentityProviderClient) {
    throw new Error(
      "Cognito SDK missing. Run npm install in backend to add @aws-sdk/client-cognito-identity-provider."
    );
  }

  const region = process.env.COGNITO_REGION || process.env.AWS_REGION;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_APP_CLIENT_ID;

  if (!region || !userPoolId || !clientId) {
    throw new Error("COGNITO_REGION/AWS_REGION, COGNITO_USER_POOL_ID, and COGNITO_APP_CLIENT_ID are required.");
  }

  return {
    region,
    userPoolId,
    clientId,
    useCustomAttrs: String(process.env.COGNITO_USE_CUSTOM_ATTRS || "false").toLowerCase() === "true"
  };
}

function createCognitoClient(region) {
  return new CognitoIdentityProviderClient({ region });
}

async function handleMockLogin(email, password) {
  ensureMockUsers();
  const user = mockUsers.get(email);

  if (!user || user.password !== password) {
    throw new Error("Invalid email or password.");
  }

  if (user.forceChangePassword) {
    const challengeToken = randomToken(16);
    challenges.set(challengeToken, {
      provider: "mock",
      email,
      createdAt: now()
    });

    return {
      challenge: "NEW_PASSWORD_REQUIRED",
      challengeToken,
      email
    };
  }

  const token = createSession(sanitizeUser(user));
  return {
    token,
    user: sanitizeUser(user)
  };
}

async function handleMockNewPassword(challengeToken, newPassword) {
  ensureMockUsers();
  const challenge = challenges.get(challengeToken);

  if (!challenge || challenge.provider !== "mock") {
    throw new Error("Password challenge expired. Sign in again.");
  }

  const user = mockUsers.get(challenge.email);
  if (!user) throw new Error("User account not found.");

  user.password = newPassword;
  user.forceChangePassword = false;
  challenges.delete(challengeToken);

  const token = createSession(sanitizeUser(user));
  return {
    token,
    user: sanitizeUser(user)
  };
}

async function handleMockInvite(actor, payload) {
  ensureMockUsers();

  if (!actor || actor.role !== "supervisor") {
    throw new Error("Supervisor role is required to invite users.");
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const name = String(payload.name || "").trim();
  const team = String(payload.team || "").trim();
  const role = payload.role === "supervisor" ? "supervisor" : "trainee";

  if (!email || !name || !team) {
    throw new Error("email, name, and team are required.");
  }

  if (mockUsers.has(email)) {
    throw new Error("An account with this email already exists.");
  }

  const temporaryPassword = generateTempPassword();
  const user = {
    id: `u-${randomToken(5)}`,
    email,
    name,
    team,
    role,
    password: temporaryPassword,
    forceChangePassword: true
  };

  mockUsers.set(email, user);
  console.log(`[mock-invite] ${email} temporary password: ${temporaryPassword}`);

  return {
    ok: true,
    mode: "mock",
    email,
    message:
      `Invite created for ${email}. In mock mode the temporary password is logged on the backend console.`,
    temporaryPassword
  };
}

async function handleCognitoLogin(email, password) {
  const cfg = assertCognitoReady();
  const client = createCognitoClient(cfg.region);

  const response = await client.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: cfg.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    })
  );

  if (response.ChallengeName === "NEW_PASSWORD_REQUIRED") {
    const challengeToken = randomToken(16);
    challenges.set(challengeToken, {
      provider: "cognito",
      email,
      session: response.Session,
      createdAt: now()
    });

    return {
      challenge: "NEW_PASSWORD_REQUIRED",
      challengeToken,
      email
    };
  }

  const idToken = response.AuthenticationResult?.IdToken;
  if (!idToken) {
    throw new Error("Authentication succeeded but ID token was missing.");
  }

  const claims = parseJwtPayload(idToken);
  const groups = Array.isArray(claims["cognito:groups"]) ? claims["cognito:groups"] : [];
  const roleFromGroups = groups.map((value) => String(value).toLowerCase()).includes("supervisor")
    ? "supervisor"
    : "trainee";

  const user = sanitizeUser({
    id: claims.sub || email,
    email: claims.email || email,
    name: claims.name || claims.email || email,
    team: claims["custom:team"] || "Unassigned",
    role: claims["custom:role"] || roleFromGroups
  });

  return {
    token: createSession(user),
    user
  };
}

async function handleCognitoNewPassword(challengeToken, newPassword) {
  const cfg = assertCognitoReady();
  const challenge = challenges.get(challengeToken);

  if (!challenge || challenge.provider !== "cognito") {
    throw new Error("Password challenge expired. Sign in again.");
  }

  const client = createCognitoClient(cfg.region);
  const response = await client.send(
    new RespondToAuthChallengeCommand({
      ClientId: cfg.clientId,
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      Session: challenge.session,
      ChallengeResponses: {
        USERNAME: challenge.email,
        NEW_PASSWORD: newPassword
      }
    })
  );

  const idToken = response.AuthenticationResult?.IdToken;
  if (!idToken) {
    throw new Error("Password update succeeded but ID token was missing.");
  }

  const claims = parseJwtPayload(idToken);
  const groups = Array.isArray(claims["cognito:groups"]) ? claims["cognito:groups"] : [];
  const roleFromGroups = groups.map((value) => String(value).toLowerCase()).includes("supervisor")
    ? "supervisor"
    : "trainee";

  const user = sanitizeUser({
    id: claims.sub || challenge.email,
    email: claims.email || challenge.email,
    name: claims.name || claims.email || challenge.email,
    team: claims["custom:team"] || "Unassigned",
    role: claims["custom:role"] || roleFromGroups
  });

  challenges.delete(challengeToken);
  return {
    token: createSession(user),
    user
  };
}

async function handleCognitoInvite(actor, payload) {
  if (!actor || actor.role !== "supervisor") {
    throw new Error("Supervisor role is required to invite users.");
  }

  const cfg = assertCognitoReady();
  const client = createCognitoClient(cfg.region);

  const email = String(payload.email || "").trim().toLowerCase();
  const name = String(payload.name || "").trim();
  const team = String(payload.team || "").trim();
  const role = payload.role === "supervisor" ? "supervisor" : "trainee";

  if (!email || !name || !team) {
    throw new Error("email, name, and team are required.");
  }

  const temporaryPassword = generateTempPassword();
  const userAttributes = [
    { Name: "email", Value: email },
    { Name: "name", Value: name }
  ];

  if (cfg.useCustomAttrs) {
    userAttributes.push({ Name: "custom:team", Value: team });
    userAttributes.push({ Name: "custom:role", Value: role });
  }

  await client.send(
    new AdminCreateUserCommand({
      UserPoolId: cfg.userPoolId,
      Username: email,
      TemporaryPassword: temporaryPassword,
      DesiredDeliveryMediums: ["EMAIL"],
      UserAttributes: userAttributes
    })
  );

  return {
    ok: true,
    mode: "cognito",
    email,
    message: `Invite sent to ${email}. Cognito will email a temporary password.`
  };
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return json(res, 400, { error: "invalid_request", message: "email and password are required." });
  }

  try {
    const response = authMode === "cognito"
      ? await handleCognitoLogin(email, password)
      : await handleMockLogin(email, password);

    return json(res, 200, response);
  } catch (error) {
    const message = error.message || "Authentication failed.";
    return json(res, 401, { error: "auth_failed", message });
  }
}

async function handleCompletePassword(req, res) {
  const body = await readJsonBody(req);
  const challengeToken = String(body.challengeToken || "").trim();
  const newPassword = String(body.newPassword || "");

  if (!challengeToken || !newPassword) {
    return json(res, 400, {
      error: "invalid_request",
      message: "challengeToken and newPassword are required."
    });
  }

  try {
    const response = authMode === "cognito"
      ? await handleCognitoNewPassword(challengeToken, newPassword)
      : await handleMockNewPassword(challengeToken, newPassword);

    return json(res, 200, response);
  } catch (error) {
    return json(res, 400, {
      error: "challenge_failed",
      message: error.message || "Unable to complete password challenge."
    });
  }
}

async function handleInvite(req, res) {
  const actor = getSessionUser(req);
  if (!actor) {
    return json(res, 401, { error: "unauthorized", message: "Sign in is required." });
  }

  if (actor.role !== "supervisor") {
    return json(res, 403, {
      error: "forbidden",
      message: "Supervisor role is required to invite users."
    });
  }

  const body = await readJsonBody(req);

  try {
    const response = authMode === "cognito"
      ? await handleCognitoInvite(actor, body)
      : await handleMockInvite(actor, body);

    return json(res, 200, response);
  } catch (error) {
    return json(res, 400, {
      error: "invite_failed",
      message: error.message || "Invite request failed."
    });
  }
}

async function handleRequest(req, res) {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    });
    res.end();
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/health") {
    return json(res, 200, {
      ok: true,
      service: "fc-training-backend-auth",
      authMode,
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === "POST" && requestUrl.pathname === "/auth/login") {
    return handleLogin(req, res);
  }

  if (req.method === "POST" && requestUrl.pathname === "/auth/challenge/new-password") {
    return handleCompletePassword(req, res);
  }

  if (req.method === "GET" && requestUrl.pathname === "/auth/me") {
    const user = getSessionUser(req);
    if (!user) {
      return json(res, 401, { error: "unauthorized", message: "Session is missing or expired." });
    }

    return json(res, 200, { user });
  }

  if (req.method === "POST" && requestUrl.pathname === "/admin/users/invite") {
    return handleInvite(req, res);
  }

  return json(res, 404, { error: "not_found", message: "Endpoint not found." });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    json(res, 500, {
      error: "server_error",
      message: error.message || "Unexpected server error."
    });
  });
});

server.listen(port, () => {
  ensureMockUsers();

  console.log(`Backend listening on http://localhost:${port}`);
  console.log(`AUTH_MODE=${authMode}`);

  if (authMode === "mock") {
    console.log("Mock supervisor: supervisor@financialclearance.local / TempPass123!");
    console.log("Mock trainee: trainee@financialclearance.local / TempPass123!");
  }
});



