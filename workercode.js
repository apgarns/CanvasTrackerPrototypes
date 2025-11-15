export default {
  async fetch(request, env) {
    const origin = "https://apgarns.github.io"; // your GitHub Pages URL
    const cors = {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization",
      "access-control-max-age": "86400"
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);

    // ----------  /api/planner ----------
    if (url.pathname === "/api/planner") {
      const start = url.searchParams.get("start");
      const end = url.searchParams.get("end");
      const perPage = url.searchParams.get("per_page") || "50";

      const upstream = `${env.CANVAS_BASE}/api/v1/planner/items?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}&per_page=${encodeURIComponent(perPage)}`;
      const resp = await fetch(upstream, {
        headers: { Authorization: `Bearer ${env.CANVAS_TOKEN}` }
      });

      const body = await resp.arrayBuffer();
      const headers = new Headers(cors);
      headers.set("content-type", resp.headers.get("content-type") || "application/json");
      const link = resp.headers.get("Link");
      if (link) headers.set("x-pagination-link", link);

      return new Response(body, { status: resp.status, headers });
    }

    // ----------/proxy (generic pass-through) ----------
    if (url.pathname === "/proxy") {
      const path = url.searchParams.get("path"); // e.g. /api/v1/planner_notes
      if (!path) {
        return new Response(JSON.stringify({ error: "Missing path" }), { status: 400, headers: cors });
      }

      // Rebuild upstream URL
      const upstream = new URL(env.CANVAS_BASE.replace(/\/$/, "") + path);
      url.searchParams.forEach((v, k) => {
        if (k !== "path") upstream.searchParams.set(k, v);
      });

      // Forward method, headers, and body
      const init = {
        method: request.method,
        headers: { "Authorization": `Bearer ${env.CANVAS_TOKEN}` }
      };

      if (request.method !== "GET" && request.method !== "HEAD") {
        const ct = request.headers.get("content-type") || "application/json";
        init.headers["content-type"] = ct;
        init.body = await request.arrayBuffer();
      }

      const resp = await fetch(upstream.toString(), init);
      const body = await resp.arrayBuffer();
      const h = new Headers(cors);
      h.set("content-type", resp.headers.get("content-type") || "application/json");
      const link = resp.headers.get("Link");
      if (link) h.set("x-pagination-link", link);

      return new Response(body, { status: resp.status, headers: h });
    }

    // ---------- Default fallback ----------
    return new Response("OK", { headers: cors });
  }
};
