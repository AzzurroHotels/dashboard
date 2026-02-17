// auth.js — Authentication logic (no style/layout changes)

// Import shared Supabase client + config check
import { supabase, isSupabaseConfigured } from "./supabase-config.js";

// ---- FIX 1: provide global showMode for inline onclick handlers ----
// This prevents: "Uncaught ReferenceError: showMode is not defined"
window.showMode = function (mode) {
  // Try to find common containers by id/class/data attributes.
  // If not found, do nothing (but at least avoids runtime crash).
  const norm = String(mode || "").toLowerCase();

  // Candidate selectors for "sign in" and "create account" sections
  const signInSelectors = [
    "#signInScreen", "#signinScreen", "#signIn", "#signin",
    "#loginScreen", "#login", "#loginForm",
    '[data-mode="signin"]', '[data-mode="login"]', '[data-auth-mode="signin"]'
  ];
  const signUpSelectors = [
    "#createAccountScreen", "#signupScreen", "#signUpScreen", "#signup", "#signUp",
    "#registerScreen", "#register", "#signupForm",
    '[data-mode="signup"]', '[data-mode="register"]', '[data-auth-mode="signup"]'
  ];

  function firstMatch(selectors) {
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  }

  const signInEl = firstMatch(signInSelectors);
  const signUpEl = firstMatch(signUpSelectors);

  // Hide both if present
  if (signInEl) signInEl.style.display = "none";
  if (signUpEl) signUpEl.style.display = "none";

  // Show requested
  if (norm.includes("sign") && norm.includes("up")) {
    if (signUpEl) signUpEl.style.display = "";
  } else if (norm.includes("create") || norm.includes("register") || norm.includes("signup")) {
    if (signUpEl) signUpEl.style.display = "";
  } else {
    if (signInEl) signInEl.style.display = "";
  }
};

// ---- Helpers ----
function $(id) { return document.getElementById(id); }

function setMessage(msg, type) {
  // Try common message containers (keeps your UI unchanged)
  const candidates = [
    $("authMessage"),
    $("message"),
    $("statusMessage"),
    document.querySelector("[data-auth-message]"),
  ].filter(Boolean);

  if (!candidates.length) return;

  const el = candidates[0];
  el.textContent = msg || "";
  el.style.display = msg ? "" : "none";
  // If you already use classes, we won't override them.
}

function getValueByAny(ids) {
  for (const id of ids) {
    const el = $(id) || document.querySelector(id);
    if (el && typeof el.value === "string") return el.value;
  }
  return "";
}

// ---- Init ----
document.addEventListener("DOMContentLoaded", () => {
  // Config warning handling
  if (!isSupabaseConfigured || !isSupabaseConfigured()) {
    setMessage("Supabase not configured. Open supabase-config.js and paste your Project URL + anon key.", "error");
    return;
  }

  // Wire buttons if present (does not change HTML)
  const signInBtn =
    $("signInBtn") ||
    $("loginBtn") ||
    document.querySelector('[data-action="signin"]') ||
    document.querySelector('button[type="submit"][data-mode="signin"]');

  const createBtn =
    $("createAccountBtn") ||
    $("signUpBtn") ||
    document.querySelector('[data-action="signup"]') ||
    document.querySelector('button[type="submit"][data-mode="signup"]');

  if (signInBtn) {
    signInBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await handleSignIn();
    });
  }

  if (createBtn) {
    createBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await handleSignUp();
    });
  }
});

// ---- Auth Actions ----
async function handleSignIn() {
  try {
    const email = (getValueByAny(["email", "loginEmail", "#email", "#loginEmail"]) || "").trim();
    const password = getValueByAny(["password", "loginPassword", "#password", "#loginPassword"]);

    if (!email || !password) {
      setMessage("Please enter email and password.", "error");
      return;
    }

    // FIX 2: use Supabase v2 login method
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message || "Login failed.", "error");
      return;
    }

    setMessage("", "ok");

    // Redirect if your app expects it (keeps your design)
    // If you already handle redirect elsewhere, this won't break.
    if (data?.session) {
      // Try to respect existing flow:
      // If app.html exists, go there; otherwise stay.
      const maybeApp = "app.html";
      if (location.pathname.endsWith("/") || location.pathname.endsWith("index.html")) {
        // Only redirect from the landing auth page
        window.location.href = maybeApp;
      }
    }
  } catch (err) {
    setMessage(err?.message || "Login error.", "error");
  }
}

async function handleSignUp() {
  try {
    const fullName = (getValueByAny(["fullName", "name", "signupFullName", "#fullName", "#name", "#signupFullName"]) || "").trim();
    const email = (getValueByAny(["email", "signupEmail", "#email", "#signupEmail"]) || "").trim();
    const password = getValueByAny(["password", "signupPassword", "#password", "#signupPassword"]);

    if (!email || !password) {
      setMessage("Please enter email and password.", "error");
      return;
    }

    // FIX 3: Supabase v2 signup method
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: fullName ? { full_name: fullName } : {}
      }
    });

    if (error) {
      // Give a helpful hint when Supabase returns 500 due to email/SMTP or triggers
      const msg = error.message || "Signup failed.";
      setMessage(msg + " (If you see 500 error, check Supabase Auth email confirmation/SMTP or database triggers.)", "error");
      return;
    }

    // Optional: try to write to profiles (do NOT block signup if RLS blocks)
    const userId = data?.user?.id;
    if (userId) {
      try {
        await supabase.from("profiles").upsert(
          { id: userId, full_name: fullName || null, email },
          { onConflict: "id" }
        );
      } catch (_) {
        // Ignore: profile may be managed by trigger/RLS
      }
    }

    // If email confirmation is enabled, session may be null
    if (data?.session) {
      setMessage("", "ok");
      window.location.href = "app.html";
    } else {
      setMessage("Account created. Please check your email for confirmation (if enabled).", "ok");
    }
  } catch (err) {
    setMessage(err?.message || "Signup error.", "error");
  }
}
