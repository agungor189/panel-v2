const endpoint = "http://localhost:3000/api/exchange-rate/refresh";
fetch(endpoint, { method: "POST" })
.then(r => r.json())
.then(console.log)
.catch(console.error);
