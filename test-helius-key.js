
const API_KEY = '251ce93e-be5b-4d6e-9c96-a9805fae66de';

async function testHeliusKey() {
  const url = `https://mainnet.helius-rpc.com/?api-key=${API_KEY}`;
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getLatestBlockhash",
    params: [{ commitment: "confirmed" }]
  };

  console.log(`Testing Helius Key: ${API_KEY}`);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    
    console.log(`Status: ${resp.status}`);
    const data = await resp.text();
    console.log(`Response: ${data}`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}

testHeliusKey();
