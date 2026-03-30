(function (global) {
  'use strict';

  const base = '';

  async function parse(res) {
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error('Réponse non JSON');
    }
    if (!res.ok) {
      const msg = data.data && data.data.message ? data.data.message : res.statusText;
      throw new Error(msg || 'Erreur HTTP');
    }
    if (data.status === 'error') {
      throw new Error((data.data && data.data.message) || 'Erreur');
    }
    return data.data;
  }

  function req(method, path, body) {
    const opts = {
      method,
      credentials: 'include',
      headers: { Accept: 'application/json' },
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(base + path, opts).then(parse);
  }

  global.api = {
    get: (p) => req('GET', p),
    post: (p, b) => req('POST', p, b),
    put: (p, b) => req('PUT', p, b),
    delete: (p) => req('DELETE', p),
  };
})(typeof window !== 'undefined' ? window : globalThis);
