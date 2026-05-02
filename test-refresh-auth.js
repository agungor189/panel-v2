const endpoint = "http://localhost:3000/api/auth/login";
fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "admin" })
})
.then(r => r.json())
.then(data => {
  if (data.token) {
    return fetch("http://localhost:3000/api/exchange-rate/refresh", {
      method: "POST",
      headers: { "Authorization": `Bearer ${data.token}` }
    }).then(r => r.text()).then(text => console.log("Refresh endpoint:", text));
  }
})
.catch(console.error);
