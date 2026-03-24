export default function handler(req, res) {
  return res.status(200).json({
    name: 'Hot Right Now API',
    endpoints: {
      '/api/trending': 'Live trending Solana tokens from DexScreener (gainers + volume)',
      '/api/leaderboard': 'Top Solana traders leaderboard',
    },
    source: 'dexscreener',
    updatedAt: new Date().toISOString(),
  });
}
