export async function retryGeminiRequest(fn, retries = 3, initialDelay = 5000) { // Increased initial delay to 5s
  for (let attempt = 1; attempt <= retries; attempt++) {
      try {
          console.log(`[AI] Attempt ${attempt} of ${retries}...`);
          return await fn();
      } catch (err) {
          // Check for Rate Limit (429) or Overload (503)
          const isRetryable = (err.status === 429 || err.status === 503) && attempt < retries;

          if (isRetryable) {
              const delay = initialDelay * Math.pow(2, attempt - 1);
              console.warn(`[AI Cooldown] Status ${err.status}. Waiting ${delay}ms before next call...`);
              await new Promise((res) => setTimeout(res, delay));
              continue;
          }
          throw err; // Don't retry on 404 or 401
      }
  }
}