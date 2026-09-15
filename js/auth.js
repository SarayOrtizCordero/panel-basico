const sessionLoading = document.getElementById("sessionLoading");
const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const logoutBtn = document.getElementById("logoutBtn");

const SESSION_STORAGE_KEY = "panelbasico-session";

let appLoaded = false;

function showApp() {
  sessionLoading.hidden = true;
  loginScreen.hidden = true;
  appScreen.hidden = false;
}

function showLogin() {
  sessionLoading.hidden = true;
  appScreen.hidden = true;
  loginScreen.hidden = false;
  loginForm.reset();
  loginError.hidden = true;
}

function hasSession() {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY) === "1";
  } catch (error) {
    return false;
  }
}

function setSession(active) {
  try {
    if (active) localStorage.setItem(SESSION_STORAGE_KEY, "1");
    else localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    // localStorage no disponible (modo privado, etc.) — la sesión no se
    // recuerda entre visitas, pero el login de esta pestaña sigue funcionando.
  }
}

if (hasSession()) {
  showApp();
  appLoaded = true;
  initApp();
} else {
  showLogin();
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loginError.hidden = true;
  loginSubmitBtn.disabled = true;
  loginSubmitBtn.textContent = "Entrando…";

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  // Pequeño retardo para conservar la misma sensación de "entrando…" que
  // había con la llamada de red a Supabase.
  setTimeout(() => {
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = "Entrar";

    if (email === DEMO_LOGIN_EMAIL && password === DEMO_LOGIN_PASSWORD) {
      setSession(true);
      showApp();
      if (!appLoaded) {
        appLoaded = true;
        initApp();
      }
    } else {
      loginError.textContent = "Correo o contraseña incorrectos.";
      loginError.hidden = false;
    }
  }, 300);
});

logoutBtn.addEventListener("click", () => {
  setSession(false);
  appLoaded = false;
  showLogin();
});
