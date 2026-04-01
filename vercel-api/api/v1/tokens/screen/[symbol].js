// Screen by symbol — search DexScreener for the token, then delegate to screen-address
import screenHandler from '../screen-address.js';

const DEXSCREENER = 'https://api.dexscreener.com';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbol = req.query.symbol;
  if (!symbol) return res.status(400).json({ error: 'symbol is required' });

  try {
    // Search DexScreener for the symbol
    const searchRes = await fetch(`${DEXSCREENER}/latest/dex/search?q=${encodeURIComponent(symbol)}`);
    if (!searchRes.ok) return res.status(404).json({ error: `Could not find "${symbol}"` });

    const data = await searchRes.json();
    const pairs = data.pairs || [];

    // Find the best Solana match
    const solPair = pairs.find(p => p.chainId === 'solana' && p.baseToken?.symbol?.toUpperCase() === symbol.toUpperCase())
      || pairs.find(p => p.chainId === 'solana');

    if (!solPair?.baseToken?.address) {
      return res.status(404).json({ error: `Could not find "${symbol}" on Solana` });
    }

    // Delegate to screen-address handler
    req.method = 'POST';
    req.body = { address: solPair.baseToken.address };
    return screenHandler(req, res);
  } catch (e) {
    return res.status(500).json({ error: 'Screening failed' });
  }
}
