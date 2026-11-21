// /api/tmdb/* -> https://api.themoviedb.org/3/*
//
// Why this file exists: the browser used to call api.themoviedb.org directly
// and attach `Authorization: Bearer <TMDB_READ_TOKEN>` itself, which meant the
// token sat in plain text in index.html and was visible to anyone who opened
// the page's source or network tab. This function moves that attachment
// server-side: the browser now calls this same-origin route with the exact
// same path and query string it always built, this function reattaches the
// token, forwards to TMDb, and streams the response straight back. The
// token itself never reaches the browser.
//
// Every TMDb call this app makes is a plain GET with no request body (see
// the 31 call sites in index.html before this change: search/multi,
// search/movie, search/tv, search/person, search/company, movie/:id,
// tv/:id, tv/:id/season/:n, person/:id, company/:id, tv/:id/season/1/videos,
// movie/:id/watch/providers - all GET, all just query-string parameters).
// So this proxy only needs to support GET; it rejects anything else rather
// than quietly forwarding a method TMDb was never going to receive from this
// app anyway.
//
// Setup needed in the Vercel dashboard (Project Settings -> Environment
// Variables): add TMDB_READ_TOKEN with the same v4 read-access token value
// that used to be the TMDB_READ_TOKEN constant in index.html, then redeploy
// (see the setup guide for the exact steps and value).

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const token = process.env.TMDB_READ_TOKEN;
    if (!token) {
        // Fails loudly rather than silently calling TMDb with no auth (which
        // TMDb would reject with its own 401) - this way the Vercel function
        // log names the exact missing env var instead of a generic TMDb error.
        res.status(500).json({ error: 'Server misconfiguration: TMDB_READ_TOKEN is not set' });
        return;
    }

    // req.query.path is the array Vercel's [...path] catch-all segment gives
    // for everything after /api/tmdb/ (e.g. /api/tmdb/tv/1399/season/1 ->
    // ['tv', '1399', 'season', '1']). Everything else in req.query is the
    // original query string (query, append_to_response, language, page,
    // include_adult, ...) exactly as index.html already built it, so it's
    // forwarded unchanged rather than re-parsed field by field - this proxy
    // doesn't need to know what any individual TMDb parameter means.
    const { path, ...params } = req.query;
    if (!path || (Array.isArray(path) && path.length === 0)) {
        res.status(400).json({ error: 'Missing TMDb path' });
        return;
    }
    const tmdbPath = Array.isArray(path) ? path.join('/') : path;

    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
            value.forEach(v => search.append(key, v));
        } else if (value !== undefined) {
            search.append(key, value);
        }
    }
    const qs = search.toString();
    const targetUrl = `https://api.themoviedb.org/3/${tmdbPath}${qs ? `?${qs}` : ''}`;

    try {
        const tmdbResponse = await fetch(targetUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        const body = await tmdbResponse.text();
        // TMDb error responses (404 for an unknown id, 401 for a bad token,
        // etc.) are still valid JSON with a useful message, so the original
        // status and body are passed through rather than collapsed into a
        // generic 502 - the client's existing `if (!response.ok)` handling
        // keeps working exactly as it did when it called TMDb directly.
        res.status(tmdbResponse.status);
        res.setHeader('Content-Type', tmdbResponse.headers.get('content-type') || 'application/json');
        // Safe to cache briefly at the edge/CDN layer: this data is the same
        // for every visitor (no per-user auth in the request) and TMDb data
        // doesn't change second to second, so a short cache cuts down on
        // repeat lookups for the same title without ever serving stale data
        // for long.
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        res.send(body);
    } catch (err) {
        res.status(502).json({ error: 'Failed to reach TMDb', detail: String(err) });
    }
}
