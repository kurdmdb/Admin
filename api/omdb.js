// /api/omdb -> https://www.omdbapi.com/
//
// Same reasoning as api/tmdb/[...path].js: OMDb's key used to travel in the
// URL as ?apikey=... built directly in the browser (the 4 call sites in
// index.html before this change: fetchRatingsFromOMDb by imdbId,
// fetchRatingsFromOMDbByTitle by title+year, and the season/episode rating
// lookups). This function reattaches the key server-side instead, so the
// browser sends every OMDb parameter except apikey and never sees the key
// itself.
//
// Setup needed in the Vercel dashboard (Project Settings -> Environment
// Variables): add OMDB_API_KEY with the same value that used to be the
// OMDB_API_KEY constant in index.html, then redeploy.

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const apikey = process.env.OMDB_API_KEY;
    if (!apikey) {
        res.status(500).json({ error: 'Server misconfiguration: OMDB_API_KEY is not set' });
        return;
    }

    // Forwards every query param the client sent (i, t, y, Season, Episode,
    // ...) unchanged, the same way api/tmdb does - this proxy doesn't need
    // to know OMDb's parameter names, only that apikey is never one the
    // client is allowed to set itself.
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
        if (key.toLowerCase() === 'apikey') continue; // never trust a client-supplied key
        if (Array.isArray(value)) {
            value.forEach(v => search.append(key, v));
        } else if (value !== undefined) {
            search.append(key, value);
        }
    }
    search.set('apikey', apikey);

    const targetUrl = `https://www.omdbapi.com/?${search.toString()}`;

    try {
        const omdbResponse = await fetch(targetUrl);
        const body = await omdbResponse.text();
        // OMDb always answers 200 with {"Response":"False", "Error": "..."}
        // for a not-found title/id rather than a non-200 status, so there's
        // no special-casing to do here - the status and body are passed
        // through as-is and the client's existing
        // `if (data.Response === 'False') return null` check keeps working
        // unchanged.
        res.status(omdbResponse.status);
        res.setHeader('Content-Type', omdbResponse.headers.get('content-type') || 'application/json');
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        res.send(body);
    } catch (err) {
        res.status(502).json({ error: 'Failed to reach OMDb', detail: String(err) });
    }
}
