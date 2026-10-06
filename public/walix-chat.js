/* Walix Chat web — widget embebible. Se instala con:
   <script src="https://s1.walix.app/walix-chat.js?key=TU_LLAVE" async></script> */
(function () {
  if (window.__walixChat) return;
  window.__walixChat = 1;

  var me = document.currentScript || (function () {
    var s = document.getElementsByTagName("script");
    for (var i = s.length - 1; i >= 0; i--) if ((s[i].src || "").indexOf("walix-chat.js") >= 0) return s[i];
    return null;
  })();
  var K = "";
  try { K = new URL(me.src).searchParams.get("key") || ""; } catch (e) { return; }
  if (!K) return;

  var E = "https://qomyfafowhuxuwbuubqk.supabase.co/functions/v1/web-chat";
  var S = null;
  try { S = localStorage.getItem("walix_chat_" + K); } catch (e) {}

  function post(o) {
    o.key = K;
    return fetch(E, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) })
      .then(function (r) { return r.json(); });
  }

  // Verifica que el agente esté encendido y obtiene su nombre antes de pintar nada.
  post({ action: "meta" }).then(function (meta) {
    if (!meta || !meta.enabled) return;
    var N = meta.name || "Chat";

    var css = "#wxc-b{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:56px;height:56px;border-radius:50%;border:0;background:#0f766e;color:#fff;font:600 22px system-ui;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25)}#wxc-p{position:fixed;right:20px;bottom:88px;z-index:2147483000;width:340px;max-width:calc(100vw - 40px);height:460px;max-height:70vh;background:#fff;border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;font:14px system-ui;color:#111}#wxc-h{background:#0f766e;color:#fff;padding:12px 14px;font-weight:600}#wxc-m{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}.wxc-u{align-self:flex-end;background:#0f766e;color:#fff;padding:8px 10px;border-radius:12px;max-width:80%;white-space:pre-wrap}.wxc-a{align-self:flex-start;background:#f1f5f9;padding:8px 10px;border-radius:12px;max-width:85%;white-space:pre-wrap}#wxc-f{display:flex;gap:6px;padding:10px;border-top:1px solid #e5e7eb}#wxc-f input{flex:1;border:1px solid #d1d5db;border-radius:8px;padding:8px}#wxc-f button{border:0;background:#0f766e;color:#fff;border-radius:8px;padding:0 12px;cursor:pointer}#wxc-l{padding:12px;display:flex;flex-direction:column;gap:8px}#wxc-l input{border:1px solid #d1d5db;border-radius:8px;padding:8px}#wxc-l button{border:0;background:#0f766e;color:#fff;border-radius:8px;padding:9px;cursor:pointer}";
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);

    var b = document.createElement("button");
    b.id = "wxc-b";
    b.setAttribute("aria-label", "Abrir chat");
    b.textContent = "💬";
    var p = document.createElement("div");
    p.id = "wxc-p";
    p.innerHTML = '<div id="wxc-h"></div><div id="wxc-m"></div>';
    document.body.appendChild(b);
    document.body.appendChild(p);
    p.querySelector("#wxc-h").textContent = N;
    var m = p.querySelector("#wxc-m");

    function add(t, r) {
      var d = document.createElement("div");
      d.className = r === "u" ? "wxc-u" : "wxc-a";
      d.textContent = t;
      m.appendChild(d);
      m.scrollTop = m.scrollHeight;
      return d;
    }

    function composer() {
      var f = document.createElement("form");
      f.id = "wxc-f";
      f.innerHTML = '<input placeholder="Escribe tu mensaje..." maxlength="2000"/><button>Enviar</button>';
      p.appendChild(f);
      f.onsubmit = function (e) {
        e.preventDefault();
        var i = f.querySelector("input"), t = i.value.trim();
        if (!t) return;
        i.value = "";
        add(t, "u");
        var w = add("…", "a");
        post({ action: "message", session_id: S, text: t })
          .then(function (r) { w.textContent = r.reply || r.error || "Ocurrió un error"; })
          .catch(function () { w.textContent = "Ocurrió un error"; });
      };
    }

    function lead() {
      var l = document.createElement("form");
      l.id = "wxc-l";
      l.innerHTML = '<div>Para atenderte mejor, déjanos tus datos:</div><input name="n" placeholder="Nombre" required/><input name="p" placeholder="WhatsApp / teléfono"/><input name="e" type="email" placeholder="Correo"/><button>Iniciar chat</button>';
      m.appendChild(l);
      l.onsubmit = function (e) {
        e.preventDefault();
        post({ action: "start", name: l.n.value, phone: l.p.value, email: l.e.value }).then(function (r) {
          if (!r.session_id) { alert(r.error || "Error"); return; }
          S = r.session_id;
          try { localStorage.setItem("walix_chat_" + K, S); } catch (e) {}
          l.remove();
          if (r.greeting) add(r.greeting, "a");
          composer();
        });
      };
    }

    var init = 0;
    b.onclick = function () {
      p.style.display = p.style.display === "flex" ? "none" : "flex";
      if (init) return;
      init = 1;
      if (S) {
        post({ action: "start", session_id: S }).then(function (r) {
          if (!r.session_id) { S = null; lead(); return; }
          (r.history || []).forEach(function (h) { add(h.body, h.role === "visitor" ? "u" : "a"); });
          composer();
        });
      } else lead();
    };
  }).catch(function () {});
})();
