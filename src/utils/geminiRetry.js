export async function retryGeminiRequest(fn, retries = 3, delay = 700) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        // Retry only for 503 overload error
        if (err.status === 503 && attempt < retries) {
          console.log(`Gemini overloaded. Retrying attempt ${attempt}...`);
          await new Promise((res) => setTimeout(res, delay));
          continue;
        }
        throw err;
      }
    }
  }