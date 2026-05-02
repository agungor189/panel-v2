import fetch from "node-fetch";

async function run() {
    try {
        const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-TRY");
        const data = await res.json();
        console.log("awesomeapi rate:", data);
    } catch(e) {
        console.log("failed arrow", e.message);
    }
}
run();
