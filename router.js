// ================================================================
//  router.js — Registo de rotas + imports ESTÁTICOS
//
//  Funciona com file:// (sem servidor HTTP).
//  Todos os módulos são importados uma vez no arranque;
//  o router apenas chama init() / cleanup() conforme a rota activa.
//
//  Para adicionar um novo módulo:
//    1. Criar assets/js/modules/nome.js  (export default { init })
//    2. Importá-lo no bloco de imports abaixo (uma linha)
//    3. Adicionar entrada em ROUTES (uma linha)
//    Não é necessário tocar em mais nenhum ficheiro.
// ================================================================

import { marcarNavActiva } from "./ui.js";

// ── Imports estáticos de todos os módulos ────────────────────────
import modDashboard      from "./modules/dashboard.js";
import modFuncionarios   from "./modules/funcionarios.js";
import modProcessamento  from "./modules/processamento.js";
import modRecibos        from "./modules/recibos.js";
import modBancoHoras     from "./modules/banco-horas.js";
import modFerias         from "./modules/ferias.js";
import modFaltas         from "./modules/faltas.js";

// ── Registo de rotas ─────────────────────────────────────────────
//
//  path    : fragmento de URL  (#path)
//  title   : título na topbar e no <title>
//  icon    : emoji no menu lateral
//  group   : grupo de navegação
//  mod     : referência ao módulo importado acima
//  actions : HTML opcional injectado à direita da topbar
//
const ROUTES = [
  {
    path:  "dashboard",
    title: "Dashboard",
    icon:  "📊",
    group: "Principal",
    mod:   modDashboard,
  },
  {
    path:    "funcionarios",
    title:   "Colaboradores",
    icon:    "👥",
    group:   "Gestão",
    mod:     modFuncionarios,
    actions: `<button class="btn btn--primary btn--sm" id="btnNovoFunc">＋ Novo Colaborador</button>`,
  },
  {
    path:  "processamento",
    title: "Processamento",
    icon:  "⚙️",
    group: "Gestão",
    mod:   modProcessamento,
  },
  {
    path:    "recibos",
    title:   "Recibos",
    icon:    "🧾",
    group:   "Gestão",
    mod:     modRecibos,
    actions: `<a href="#processamento" class="btn btn--primary btn--sm">⚙️ Processar novo</a>`,
  },
  {
    path:    "banco-horas",
    title:   "Banco de Horas",
    icon:    "⏱️",
    group:   "Assiduidade",
    mod:     modBancoHoras,
    actions: `<button class="btn btn--primary btn--sm" id="btnNovoMov">＋ Registar Movimento</button>`,
  },
  {
    path:    "ferias",
    title:   "Férias",
    icon:    "🌴",
    group:   "Assiduidade",
    mod:     modFerias,
    actions: `<button class="btn btn--primary btn--sm" id="btnNovoPedido">＋ Novo Pedido</button>`,
  },
  {
    path:    "faltas",
    title:   "Faltas",
    icon:    "📅",
    group:   "Assiduidade",
    mod:     modFaltas,
    actions: `<button class="btn btn--primary btn--sm" id="btnNovaFalta">＋ Registar Falta</button>`,
  },
];

// ── Construir navegação (uma única vez) ──────────────────────────
function buildNav() {
  const groups = {};
  for (const r of ROUTES) (groups[r.group] ??= []).push(r);
  return Object.entries(groups).map(([label, routes]) => `
    <div class="nav__group">
      <div class="nav__label">${label}</div>
      ${routes.map(r => `
        <a href="#${r.path}" class="nav__link" data-path="${r.path}">
          <span class="nav__icon">${r.icon}</span> ${r.title}
        </a>`).join("")}
    </div>`).join("");
}

// ── Estado do router ─────────────────────────────────────────────
let activeCleanup = null;

async function loadRoute(path) {
  const route = ROUTES.find(r => r.path === path) ?? ROUTES[0];

  // Limpar módulo anterior
  if (typeof activeCleanup === "function") {
    try { activeCleanup(); } catch (e) { console.warn("[router] cleanup error", e); }
    activeCleanup = null;
  }

  // Actualizar shell
  document.title = `Portal RH — ${route.title}`;
  document.getElementById("appTitle").textContent        = route.title;
  document.getElementById("appTopbarActions").innerHTML  = route.actions ?? "";
  document.getElementById("appContent").innerHTML =
    `<div class="page-loading"><div class="spinner"></div><span>A carregar…</span></div>`;

  marcarNavActiva(path);

  // Inicializar módulo (já importado estaticamente)
  try {
    const cleanup = await route.mod.init?.({ route });
    if (typeof cleanup === "function") activeCleanup = cleanup;
  } catch (err) {
    console.error(`[router] erro no módulo "${route.path}":`, err);
    document.getElementById("appContent").innerHTML = `
      <div class="error-state">
        <div class="error-state__icon">⚠️</div>
        <div class="error-state__title">Erro ao carregar módulo</div>
        <div class="error-state__msg"><code>${err.message}</code></div>
        <p style="font-size:.8rem;color:var(--c-ink-3);margin-top:8px">
          Verifique a consola do browser (F12) para mais detalhes.
        </p>
      </div>`;
  }
}

// ── Bootstrap ────────────────────────────────────────────────────
document.getElementById("appNav").innerHTML      = buildNav();
document.getElementById("anoActual").textContent = new Date().getFullYear();

// Hash routing
function onHashChange() {
  const path = location.hash.replace("#", "") || "dashboard";
  loadRoute(path);
}
window.addEventListener("hashchange", onHashChange);
onHashChange(); // carga inicial

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
document.getElementById("appNav").addEventListener("click", () => {
  sidebar.classList.remove("open");
  overlay.classList.remove("active");
});
