const API = "http://localhost:5000/api/auth";
const msg = document.getElementById("msg");

// Signup
document.getElementById("signupForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target).entries());
  const r = await fetch(API + "/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  alert(data.message || r.statusText);
});

// Login
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target).entries());
  const r = await fetch(API + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (r.ok) {
    localStorage.setItem("token", data.token);
    msg && (msg.textContent = "Login success");
  } else {
    msg && (msg.textContent = data.message || "Login failed");
  }
});

// Admin page load
(async function loadPending() {
  const list = document.getElementById("list");
  if (!list) return;
  const token = localStorage.getItem("token");
  const r = await fetch(API + "/pending", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const users = await r.json();
  list.innerHTML = "";
  users.forEach(u => {
    const li = document.createElement("li");
    li.textContent = `${u.name} - ${u.email}`;
    const a = document.createElement("button"); a.textContent = "Approve";
    const rej = document.createElement("button"); rej.textContent = "Reject";
    a.onclick = async () => {
      await fetch(`${API}/${u._id}/approve`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
      li.remove();
    };
    rej.onclick = async () => {
      await fetch(`${API}/${u._id}/reject`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
      li.remove();
    };
    li.append(" ", a, " ", rej);
    list.appendChild(li);
  });
})();
