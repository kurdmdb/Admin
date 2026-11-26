// Rewrites /api/tmdb/:path* to this function with ?path=<captured-path>.
// Keeps the TMDb read token on the server and forwards the remaining query.
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.TMDB_READ_TOKEN;
  if (!token) {
    return res.status(500).json({
      error: "Server misconfiguration: TMDB_READ_TOKEN is not set"
    });
  }

  try {
    const incoming = new URL(req.url || "/", "https://vercel.local");
    const requestedPath = incoming.searchParams.get("path") || "";
    const segments = requestedPath.split("/").filter(Boolean);

    if (!segments.length || segments.some((part) => part === "." || part === "..")) {
      return res.status(400).json({ error: "Missing or invalid TMDb path" });
    }

    const tmdbPath = segments.map(encodeURIComponent).join("/");
    const upstreamQuery = new URLSearchParams();

    for (const [key, value] of incoming.searchParams.entries()) {
      if (key !== "path") upstreamQuery.append(key, value);
    }

    const queryString = upstreamQuery.toString();
    const targetUrl = `https://api.themoviedb.org/3/${tmdbPath}${queryString ? `?${queryString}` : ""}`;
    const upstream = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.send(body);
  } catch (error) {
    return res.status(502).json({
      error: "Failed to reach TMDb",
      detail: error instanceof Error ? error.message : "Unknown upstream error"
    });
  }
};
