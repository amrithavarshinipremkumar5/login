// Use same-origin HTTPS (no hardcoded base)
const API = "";

// Generic helpers
async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) throw new Error((data && data.message) || `HTTP ${res.status}`);
  return data ?? {};
}

// LOGIN
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const remember = document.getElementById("remember")?.checked || false;

  try {
    const data = await jsonFetch(`${API}/api/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password, remember }),
    });
    // handle success (token/cookie already set by server if any)
    window.location.href = "/dashboard.html";
  } catch (err) {
    showError(err.message || "Network error");
  }
});

// SIGNUP (send username to match backend requirement)
document.getElementById("signupForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const usernameEl = document.getElementById("username"); // ensure this input exists
  const username = usernameEl ? usernameEl.value.trim() : "";

  try {
    await jsonFetch(`${API}/api/auth/signup`, {
      method: "POST",
      body: JSON.stringify({ name, email, username, password }),
    });
    alert("Signup successful. Please log in.");
    window.location.href = "/index.html";
  } catch (err) {
    showError(err.message || "Network error");
  }
});

// FORGOT
document.getElementById("forgotForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  try {
    await jsonFetch(`${API}/api/auth/forgot`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    alert("If the email exists, a reset link was sent.");
  } catch (err) {
    showError(err.message || "Network error");
  }
});

// RESET
document.getElementById("resetForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const params = new URLSearchParams(location.search);
  const token = params.get("token");
  const password = document.getElementById("password").value;
  const confirm = document.getElementById("confirm")?.value ?? document.querySelector('input[name="confirmPassword"]')?.value;
  if (password !== confirm) return showError("Passwords do not match");
  try {
    await jsonFetch(`${API}/api/auth/reset`, {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    alert("Password reset successful. Please log in.");
    window.location.href = "/index.html";
  } catch (err) {
    showError(err.message || "Network error");
  }
});

// ADMIN pending list + approve
async function loadPending() {
  const ul = document.getElementById("list");
  if (!ul) return;
  ul.innerHTML = "Loading...";
  try {
    const data = await jsonFetch(`${API}/api/auth/pending`);
    if (!data.users || !data.users.length) {
      ul.innerHTML = "<li>No pending users</li>";
      return;
    }
    ul.innerHTML = "";
    data.users.forEach((u) => {
      const li = document.createElement("li");
      li.textContent = `${u.name} (${u.email}) `;
      const btn = document.createElement("button");
      btn.textContent = "Approve";
      btn.onclick = async () => {
        btn.disabled = true; btn.textContent = "Approving...";
        try {
          await jsonFetch(`${API}/api/auth/approve/${u._id}`, { method: "PATCH" });
          li.remove();
        } catch (err) {
          btn.disabled = false; btn.textContent = "Approve";
          alert(err.message || "Error");
        }
      };
      li.appendChild(btn);
      ul.appendChild(li);
    });
  } catch (err) {
    ul.innerHTML = `<li>Error: ${err.message || "Network"}</li>`;
  }
}
document.addEventListener("DOMContentLoaded", loadPending);

// Utility
function showError(msg) {
  const box = document.getElementById("errorBox");
  if (box) { box.textContent = msg; box.style.display = "block"; }
}
