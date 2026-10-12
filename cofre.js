/* Materiais de SQL: abre as páginas protegidas.
   Cada página publicada está criptografada (AES-GCM). A chave só fica no navegador
   de quem fez login (login.html). Sem a chave, a página manda para o login. */
(function () {
  var CHAVE = 'cofre-chave';
  var script = document.currentScript;
  var base = script.src.replace(/cofre\.js(\?.*)?$/, '');

  function lerChave() {
    try { return sessionStorage.getItem(CHAVE) || localStorage.getItem(CHAVE); } catch (e) { return null; }
  }
  function bytes(b64) { return Uint8Array.from(atob(b64), function (c) { return c.charCodeAt(0); }); }
  function abrir(b64) {
    var raw = lerChave();
    if (!raw || !window.crypto || !crypto.subtle) return Promise.reject(new Error('sem chave'));
    return crypto.subtle.importKey('raw', bytes(raw), 'AES-GCM', false, ['decrypt']).then(function (k) {
      var d = bytes(b64);
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: d.slice(0, 12) }, k, d.slice(12));
    });
  }
  function irParaLogin() {
    var aqui = location.href.indexOf(base) === 0 ? location.href.slice(base.length) : '';
    location.replace(base + 'login.html?volta=' + encodeURIComponent(aqui || 'index.html'));
  }

  if (script.getAttribute('data-modo') === 'pos') {
    // Página já aberta: os scripts .sql também estão criptografados (.sql.enc).
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href');
      if (!/\.sql$/i.test(href) || /^[a-z]+:/i.test(href)) return;
      e.preventDefault();
      fetch(new URL(href + '.enc', location.href), { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (t) { return abrir(t.trim()); })
        .then(function (pt) {
          var url = URL.createObjectURL(new Blob([pt], { type: 'text/plain;charset=utf-8' }));
          var d = document.createElement('a');
          d.href = url; d.download = href.split('/').pop();
          document.body.appendChild(d); d.click(); d.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        })
        .catch(irParaLogin);
    });
    return;
  }

  var dados = document.getElementById('cofre-dados');
  // Espera a página-casca terminar de carregar: com o leitor de HTML ainda ativo,
  // o document.write acrescentaria em vez de substituir.
  var carregada = new Promise(function (ok) {
    if (document.readyState === 'complete') ok(); else window.addEventListener('load', function () { ok(); });
  });
  Promise.all([abrir(dados.textContent.trim()), carregada]).then(function (r) {
    var html = new TextDecoder().decode(r[0]);
    document.open(); document.write(html); document.close();
  }).catch(irParaLogin);
})();
