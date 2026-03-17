
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZGxjYXZjZHFzZm13aXBlcWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMjY2MDQsImV4cCI6MjA4NTYwMjYwNH0.ArCJlfPbWNKYvHI_qgFhD8f0Uf0zW3sR5bkA3zgVYow";

async function testHeliusProxy() {
  const url = "https://spdlcavcdqsfmwipeqkp.supabase.co/functions/v1/helius-proxy";
  const body = {
    action: "rpc",
    rpcBody: {
      jsonrpc: "2.0",
      id: 1,
      method: "getLatestBlockhash",
      params: [{ commitment: "confirmed" }]
    }
  };

  console.log(`Testing Helius Proxy: ${url}`);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify(body)
    });
    
    console.log(`Status: ${resp.status}`);
    const data = await resp.text();
    console.log(`Response: ${data}`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}

testHeliusProxy();
