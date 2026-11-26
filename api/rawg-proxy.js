// Rewrites /api/rawg/:path* to this function with ?path=<captured-path>.
// Keeps the RAWG API key on the server and forwards the remaining query.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.RAWG_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: "Server misconfiguration: RAWG_API_KEY is not set"
    });
  }

  try {
    const incoming = new URL(req.url || "/", "https://vercel.local");
    const requestedPath = incoming.searchParams.get("path") || "";
    const segments = requestedPath.split("/").filter(Boolean);

    if (!segments.length || segments.some((part) => part === "." || part === "..")) {
      return res.status(400).json({ error: "Missing or invalid RAWG path" });
    }

    const rawgPath = segments.map(encodeURIComponent).join("/");
    const upstreamQuery = new URLSearchParams();

    for (const [queryKey, value] of incoming.searchParams.entries()) {
      if (queryKey !== "path" && queryKey.toLowerCase() !== "key") {
        upstreamQuery.append(queryKey, value);
      }
    }
    upstreamQuery.set("key", key);

    const targetUrl = `https://api.rawg.io/api/${rawgPath}?${upstreamQuery.toString()}`;
    const upstream = await fetch(targetUrl, {
      method: "GET",
      headers: { Accept: "application/json" }
    });

    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.send(body);
  } catch (error) {
    return res.status(502).json({
      error: "Failed to reach RAWG",
      detail: error instanceof Error ? error.message : "Unknown upstream error"
    });
  }
};
