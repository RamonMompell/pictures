/* ============================================================
   Clinia — Hash router
   ============================================================ */

(function (global) {
  const Router = {
    routes: [],
    notFound: null,
    rendering: false,

    add(pattern, handler, opts = {}) {
      const segments = pattern.split('/').filter(Boolean);
      this.routes.push({ pattern, segments, handler, opts });
      return this;
    },

    setNotFound(fn) {
      this.notFound = fn;
    },

    parse(hash) {
      const clean = (hash || '').replace(/^#\/?/, '');
      const [path, query] = clean.split('?');
      const segs = path.split('/').filter(Boolean);
      const params = new URLSearchParams(query || '');
      return { path, segs, params };
    },

    match(segs) {
      for (const r of this.routes) {
        if (r.segments.length !== segs.length) continue;
        const params = {};
        let ok = true;
        for (let i = 0; i < segs.length; i++) {
          const a = r.segments[i];
          const b = segs[i];
          if (a.startsWith(':')) {
            params[a.slice(1)] = decodeURIComponent(b);
          } else if (a !== b) {
            ok = false;
            break;
          }
        }
        if (ok) return { route: r, params };
      }
      return null;
    },

    async render() {
      if (this.rendering) return;
      this.rendering = true;
      try {
        const { segs, params } = this.parse(location.hash);
        const matched = this.match(segs);
        const ctx = { segs, query: Object.fromEntries(params.entries()), params: {} };
        if (matched) {
          ctx.params = matched.params;
          await matched.route.handler(ctx);
        } else if (this.notFound) {
          await this.notFound(ctx);
        }
      } finally {
        this.rendering = false;
      }
    },

    start() {
      window.addEventListener('hashchange', () => this.render());
      this.render();
    },

    go(path) {
      if (location.hash === '#/' + path.replace(/^\//, ''))
        return this.render();
      location.hash = '/' + path.replace(/^\//, '');
    },
  };

  global.Router = Router;
})(window);
