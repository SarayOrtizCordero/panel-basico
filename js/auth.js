const sessionLoading = document.getElementById("sessionLoading");
const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const logoutBtn = document.getElementById("logoutBtn");

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

db.auth.onAuthStateChange((event, session) => {
  if (session) {
    showApp();
    if (!appLoaded) {
      appLoaded = true;
      initApp();
    }
  } else {
    appLoaded = false;
    showLogin();
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  loginSubmitBtn.disabled = true;
  loginSubmitBtn.textContent = "Entrando…";

  const { error } = await db.auth.signInWithPassword({
    email: loginEmail.value.trim(),
    password: loginPassword.value,
  });

  loginSubmitBtn.disabled = false;
  loginSubmitBtn.textContent = "Entrar";

  if (error) {
    loginError.textContent = "Correo o contraseña incorrectos.";
    loginError.hidden = false;
  }
});

logoutBtn.addEventListener("click", () => {
  db.auth.signOut();
});
