import fetch from "node-fetch";

async function run() {
    try {
        const res = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/TRY=X");
        const data = await res.json();
        console.log("yahoo rate:", data.chart.result[0].meta.regularMarketPrice);
    } catch(e) {
        console.log("failed yahoo", e.message);
    }
}
run();
