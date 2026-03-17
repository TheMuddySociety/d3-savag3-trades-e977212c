import fetch from 'cross-fetch';

async function testConnection() {
  const hosts = [
    'https://www.google.com',
    'https://quote-api.jup.ag/v6/quote',
    'https://api.mainnet-beta.solana.com'
  ];

  for (const host of hosts) {
    try {
      console.log(`Testing ${host}...`);
      const res = await fetch(host);
      console.log(`${host}: ${res.status} ${res.statusText}`);
    } catch (err) {
      console.error(`${host}: FAILED`, err.message);
    }
  }
}

testConnection();
