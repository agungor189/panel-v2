import fetch from "node-fetch";

async function run() {
    try {
        const res = await fetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json");
        const data = await res.json();
        console.log("fawazahmed0 rate:", data.usd.try);
    } catch(e) {
        console.log("failed fawaz", e.message);
    }
}
run();
