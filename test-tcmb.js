import fetch from "node-fetch";

async function run() {
    const res = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml");
    const text = await res.text();
    console.log("Full TCMB source:", text.substring(0, 1000));
}
run();
