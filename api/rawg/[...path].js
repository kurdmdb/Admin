// /api/rawg/* -> https://api.rawg.io/api/*
//
// Same reasoning as api/tmdb/[...path].js and api/omdb.js: RAWG's key used
// to travel in the URL as ?key=... built directly in the browser (the 3
// call sites in index.html before this change: searchRcRawg's games search,
// and selectRcRawgResult's game-details + screenshots lookups, both fired
// together for a chosen game). This function reattaches the key
// server-side instead.
//
// A catch-all path (like api/tmdb) rather than a single fixed endpoint
// because RAWG is called at two different paths - /api/games (search) and
// /api/games/:id and /api/games/:id/screenshots (details) - so the client
// just swaps its https://api.rawg.io/api/ prefix for /api/rawg/ and keeps
// the rest of the path and query string exactly as it already built them.
//
// Setup needed in the Vercel dashboard (Project Settings -> Environment
// Variables): add RAWG_API_KEY with the same value that used to be the
// RAWG_API_KEY constant in index.html, then redeploy.

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const key = process.env.RAWG_API_KEY;
    if (!key) {
        res.status(500).json({ error: 'Server misconfiguration: RAWG_API_KEY is not set' });
        return;
    }

    const { path, ...params } = req.query;
    if (!path || (Array.isArray(path) && path.length === 0)) {
        res.status(400).json({ error: 'Missing RAWG path' });
        return;
    }
    const rawgPath = Array.isArray(path) ? path.join('/') : path;

    const search = new URLSearchParams();
    for (const [k, value] of Object.entries(params)) {
        if (k.toLowerCase() === 'key') continue; // never trust a client-supplied key
        if (Array.isArray(value)) {
            value.forEach(v => search.append(k, v));
        } else if (value !== undefined) {
            search.append(k, value);
        }
    }
    search.set('key', key);

    const targetUrl = `https://api.rawg.io/api/${rawgPath}?${search.toString()}`;

    try {
        const rawgResponse = await fetch(targetUrl, {
            headers: { 'Accept': 'application/json' }
        });
        const body = await rawgResponse.text();
        res.status(rawgResponse.status);
        res.setHeader('Content-Type', rawgResponse.headers.get('content-type') || 'application/json');
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        res.send(body);
    } catch (err) {
        res.status(502).json({ error: 'Failed to reach RAWG', detail: String(err) });
    }
}
