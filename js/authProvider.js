class LocalProfileAuth {
  constructor(store) {
    this.store = store;
    this.current = null;
  }

  listProfiles() {
    return this.store.getUsers();
  }

  signIn(userId) {
    const user = this.store.getUsers().find((entry) => entry.id === userId) || null;
    this.current = user;
    return user;
  }

  createProfile({ name, role, team }) {
    return this.store.createUser({ name, role, team });
  }

  signOut() {
    this.current = null;
  }

  getCurrent() {
    return this.current;
  }

  describeMode() {
    return "Local profile mode is active. SSO integration scaffold is included for production handoff.";
  }
}

class SsoStubAuth {
  isAvailable() {
    return false;
  }

  getSetupMessage() {
    return "SSO stub only: wire backend OAuth endpoints and identity provider settings to enable enterprise login.";
  }
}

window.LocalProfileAuth = LocalProfileAuth;
window.SsoStubAuth = SsoStubAuth;
