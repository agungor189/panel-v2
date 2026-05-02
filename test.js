import { z } from "zod";
const endpoint = "http://localhost:3000/api/auth/login";
fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "admin" })
})
.then(r => r.json())
.then(data => {
  console.log("Login data:", data);
  if (data.token) {
    return fetch("http://localhost:3000/api/settings", {
      headers: { "Authorization": `Bearer ${data.token}` }
    }).then(r => r.text()).then(text => console.log("Settings endpoint:", text));
  }
})
.catch(console.error);
