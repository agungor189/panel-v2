import fetch from "node-fetch";

async function testFetch() {
  let rate = 0;
  let source = '';
  try {
    const tcmbRes = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml");
    console.log("TCMB Status:", tcmbRes.status);
    if (tcmbRes.ok) {
       const text = await tcmbRes.text();
       const match = text.match(/<Currency[^>]*Kod="USD"[\s\S]*?<ForexSelling>(.*?)<\/ForexSelling>/);
       console.log("Match:", match ? match[1] : null);
       if (match && match[1]) {
          rate = parseFloat(match[1]);
          source = 'TCMB';
       }
    }
  } catch(e) {
    console.error("TCMB error:", e);
  }
  
  if (!rate) {
     const backupRes = await fetch("https://open.er-api.com/v6/latest/USD");
     console.log("Backup status:", backupRes.status);
     if (backupRes.ok) {
         const data = await backupRes.json();
         if (data && data.rates && data.rates.TRY) {
             rate = data.rates.TRY;
             source = 'ExchangeRate-API';
         }
     }
  }
  console.log("Final Rate:", rate, "Source:", source);
}
testFetch();
