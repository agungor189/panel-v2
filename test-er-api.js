import fetch from "node-fetch";

async function run() {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();
    console.log("er-api rate:", data.rates.TRY);
}
run();
