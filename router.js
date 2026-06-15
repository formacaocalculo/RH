// ================================================================
//  router.js — Registo de rotas + carregamento dinâmico de módulos
//
//  Para adicionar um novo módulo:
//    1. Criar assets/js/modules/nome.js  (exportar default { init })
//    2. Adicionar uma entrada em ROUTES abaixo.
//    Não é necessário tocar em mais nenhum ficheiro.
// ================================================================

import { marcarNavActiva, toast } from "./ui.js";

// ── Registo de rotas ────────────────────────────────────────────
//
//  path      : fragmento de URL (#path)
//  title     : título da página (topbar + <title>)
//  icon      : emoji do menu lateral
//  group     : grupo de navegação (string label)
//  module    : caminho do módulo JS (relativo a assets/js/)
//  actions   : HTML injectado na zona direita da topbar (opcional)
//
export const ROUTES = [
  {
    path:    "dashboard",
    title:   "Dashboard",
    icon:    "📊",
    group:   "Principal",
    module:  "modules/dashboard.js",
  },
  {
    path:    "funcionarios",
    title:   "Colaboradores",
    icon:    "👥",
    group:   "Gestão",
    module:  "modules/funcionarios.js",
    actions: `<button class="btn btn--primary btn--sm" id="btnNovoFunc">＋ Novo Colaborador</button>`,
  },
  {
    path:    "processamento",
    title:   "Processamento",
    icon:    "⚙️",
    group:   "Gestão",
    module:  "modules/processamento.js",
  },
  {
    path:    "recibos",
    title:   "Recibos",
    icon:    "🧾",
    group:   "Gestão",
    module:  "modules/recibos.js",
    actions: `<a href="#processamento" class="btn btn--primary btn--sm">⚙️ Processar novo</a>`,
  },
  {
    path:    "banco-horas",
    title:   "Banco de Horas",
    icon:    "⏱️",
    group:   "Assiduidade",
    module:  "modules/banco-horas.js",
    actions: `<button class="btn btn--primary btn--sm" id="btnNovoMov">＋ Registar Movimento</button>`,
  },
  {
    path:    "ferias",
    title:   "Férias",
    icon:    "🌴",
    group:   "Assiduidade",
    module:  "modules/ferias.js",
    actions: `<button class="btn btn--primary btn--sm" id="btnNovoPedido">＋ Novo Pedido</button>`,
  },
  {
    path:    "faltas",
    title:   "Faltas",
    icon:    "📅",
    group:   "Assiduidade",
    module:  "modules/faltas.js",
    actions: `<button class="btn btn--primary btn--sm" id="btnNovaFalta">＋ Registar Falta</button>`,
  },
];

// ── Nav HTML (gerada uma única vez) ─────────────────────────────
function buildNav() {
  const groups = {};
  for (const r of ROUTES) {
    (groups[r.group] ??= []).push(r);
  }
  return Object.entries(groups).map(([label, routes]) => `
    <div class="nav__group">
      <div class="nav__label">${label}</div>
      ${routes.map(r => `
        <a href="#${r.path}" class="nav__link" data-path="${r.path}">
          <span class="nav__icon">${r.icon}</span> ${r.title}
        </a>`).join("")}
    </div>`).join("");
}

// ── Loader dinâmico ─────────────────────────────────────────────
let activeCleanup = null;   // função de limpeza do módulo anterior
let activeModule  = null;

async function loadRoute(path) {
  const route = ROUTES.find(r => r.path === path) ?? ROUTES[0];

  // Limpeza do módulo anterior
  if (typeof activeCleanup === "function") {
    try { activeCleanup(); } catch {}
  }
  activeCleanup = null;
  activeModule  = null;

  // Actualizar shell
  document.title = `Portal RH — ${route.title}`;
  document.getElementById("appTitle").textContent = route.title;
  document.getElementById("appTopbarActions").innerHTML = route.actions ?? "";
  document.getElementById("appContent").innerHTML =
    `<div class="page-loading"><div class="spinner"></div><span>A carregar…</span></div>`;

  marcarNavActiva(path);

  // Importar módulo
  try {
    const mod = await import(`./${route.module}?v=${Date.now()}`);
    activeModule = mod.default ?? mod;
    const cleanup = await activeModule.init?.({ route });
    if (typeof cleanup === "function") activeCleanup = cleanup;
  } catch (err) {
    console.error(`[Router] Erro ao carregar módulo "${route.module}":`, err);
    document.getElementById("appContent").innerHTML = `
      <div class="error-state">
        <div class="error-state__icon">⚠️</div>
        <div class="error-state__title">Erro ao carregar módulo</div>
        <div class="error-state__msg">${err.message}</div>
      </div>`;
  }
}

// ── Bootstrap ────────────────────────────────────────────────────
document.getElementById("appNav").innerHTML = buildNav();
document.getElementById("anoActual").textContent = new Date().getFullYear();

// Hash routing
function onHashChange() {
  const path = location.hash.replace("#", "") || "dashboard";
  loadRoute(path);
}
window.addEventListener("hashchange", onHashChange);
onHashChange();   // carga inicial

// Mobile burger
const burger  = document.getElementById("burgerBtn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("sidebarOverlay");
burger.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  overlay.classList.toggle("active");
});
overlay.addEventListener("click", () => {
  sidebar.classList.remove("open");
  overlay.classList.remove("active");
});
// Fechar sidebar ao navegar (mobile)
document.getElementById("appNav").addEventListener("click", () => {
  sidebar.classList.remove("open");
  overlay.classList.remove("active");
});
