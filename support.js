/* JR Propiedades - motor mínimo para las páginas de la maqueta.
   Lee la plantilla (<template id="dc-template">), ejecuta la clase Component
   (<script type="text/x-dc">) y dibuja el resultado dentro de <div id="app">. */
(function () {
  'use strict';

  class DCLogic {
    constructor(props) {
      this.props = props || {};
      this.state = {};
    }
    setState(patch) {
      Object.assign(this.state, patch);
      if (this.__render) this.__render();
    }
  }
  window.DCLogic = DCLogic;

  function resolve(expr, scope) {
    expr = String(expr).trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null' || expr === 'undefined') return undefined;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    var cur = scope;
    var parts = expr.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  var WHOLE = /^\s*\{\{([^}]*)\}\}\s*$/;
  var ANY = /\{\{([^}]*)\}\}/g;

  function interpolate(str, scope) {
    return str.replace(ANY, function (_, e) {
      var v = resolve(e, scope);
      return v == null || typeof v === 'function' ? '' : String(v);
    });
  }

  function renderNode(node, scope, out) {
    if (node.nodeType === 3) {
      out.appendChild(document.createTextNode(interpolate(node.nodeValue, scope)));
      return;
    }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === 'helmet') return;
    if (tag === 'sc-for') {
      var list = resolve((node.getAttribute('list') || '').replace(/[{}]/g, ''), scope) || [];
      var as = node.getAttribute('as') || 'item';
      for (var i = 0; i < list.length; i++) {
        var inner = Object.create(scope);
        inner[as] = list[i];
        inner.index = i;
        for (var c = node.firstChild; c; c = c.nextSibling) renderNode(c, inner, out);
      }
      return;
    }
    if (tag === 'sc-if') {
      var val = resolve((node.getAttribute('value') || '').replace(/[{}]/g, ''), scope);
      if (val) for (var d = node.firstChild; d; d = d.nextSibling) renderNode(d, scope, out);
      return;
    }
    var el = document.createElementNS(node.namespaceURI, node.localName);
    for (var a = 0; a < node.attributes.length; a++) {
      var at = node.attributes[a];
      if (at.name.indexOf('hint-') === 0) continue;
      var m = WHOLE.exec(at.value);
      if (/^on/i.test(at.name) && m) {
        var fn = resolve(m[1], scope);
        if (typeof fn === 'function') el.addEventListener(at.name.slice(2).toLowerCase(), fn);
        continue;
      }
      var v = at.value.indexOf('{{') >= 0 ? interpolate(at.value, scope) : at.value;
      el.setAttribute(at.name, v);
    }
    for (var k = node.firstChild; k; k = k.nextSibling) renderNode(k, scope, el);
    out.appendChild(el);
  }

  function start() {
    var tpl = document.getElementById('dc-template');
    var app = document.getElementById('app');
    var scriptEl = document.querySelector('script[type="text/x-dc"]');
    if (!tpl || !app || !scriptEl) return;

    // Estilos y fuentes de <helmet> al <head>
    var helmet = tpl.content.querySelector('helmet');
    if (helmet && !document.querySelector('meta[name="dc-helmet"]')) {
      Array.prototype.forEach.call(helmet.children, function (ch) {
        document.head.appendChild(ch.cloneNode(true));
      });
    }

    var defaults = {};
    try {
      var cfg = JSON.parse(scriptEl.getAttribute('data-props') || '{}');
      Object.keys(cfg).forEach(function (k) {
        if (cfg[k] && typeof cfg[k] === 'object' && 'default' in cfg[k]) defaults[k] = cfg[k].default;
      });
    } catch (e) {}

    var Component = new Function('DCLogic', scriptEl.textContent + '\n;return Component;')(DCLogic);
    var inst = new Component(defaults);

    inst.__render = function () {
      var vals = inst.renderVals();
      var frag = document.createDocumentFragment();
      for (var n = tpl.content.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 1 && n.localName === 'x-dc') {
          for (var c = n.firstChild; c; c = c.nextSibling) renderNode(c, vals, frag);
        } else if (n.nodeType === 1 || n.nodeType === 3) {
          renderNode(n, vals, frag);
        }
      }
      app.textContent = '';
      app.appendChild(frag);
    };
    inst.__render();
    document.documentElement.setAttribute('data-dc-ready', '1');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
