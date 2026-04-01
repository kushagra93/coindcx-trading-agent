// Returns same data as trending sorted by age (newest first)
import trendingHandler from './trending.js';

export default async function handler(req, res) {
  // Intercept the response to re-sort by age
  const mockRes = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) {
      if (data.tokens) {
        data.tokens.sort((a, b) => a.ageMinutes - b.ageMinutes);
      }
      return res.status(this.statusCode).json(data);
    },
    end() { return res.status(this.statusCode).end(); },
  };
  return trendingHandler(req, mockRes);
}
