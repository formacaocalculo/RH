// ================================================================
//  ui.js — Utilitários de interface partilhados por todos os módulos
//  Não tem dependências do router nem da lógica de negócio.
// ================================================================

// ── Toast ────────────────────────────────────────────────────────
export function toast(msg, tipo = "ok") {
  const el = Object.assign(document.createElement("div"), {
    className: `toast toast--${tipo}`,
    textContent: msg,
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast--show"));
  setTimeout(() => {
    el.classList.remove("toast--show");
    el.addEventListener("transitionend", () => el.remove(), { once: true });
  }, 3200);
}

// ── Spinner de botão ─────────────────────────────────────────────
export function spinner(btn, show) {
  if (!btn) return;
  btn.disabled = show;
  btn.dataset.orig ??= btn.textContent;
  btn.textContent = show ? "A processar…" : btn.dataset.orig;
}

// ── Modal ────────────────────────────────────────────────────────
export function openModal(id)  { document.getElementById(id)?.classList.add("active"); }
export function closeModal(id) { document.getElementById(id)?.classList.remove("active"); }

// Fechar ao clicar fora
export function bindModalOverlay(id) {
  document.getElementById(id)?.addEventListener("click", e => {
    if (e.target.id === id) closeModal(id);
  });
}

// ── Nav activa (chamada pelo router) ─────────────────────────────
export function marcarNavActiva(path) {
  document.querySelectorAll(".nav__link[data-path]").forEach(a => {
    a.classList.toggle("nav__link--active", a.dataset.path === path);
  });
}

// ── Tabela: estado vazio ──────────────────────────────────────────
export function semDados(tbody, cols, msg = "Sem registos.") {
  tbody.innerHTML = `<tr><td colspan="${cols}" class="empty-state">${msg}</td></tr>`;
}

// ── Blink numa linha de tabela ────────────────────────────────────
export function flashRow(tr) {
  tr.classList.add("row--flash");
  tr.addEventListener("animationend", () => tr.classList.remove("row--flash"), { once: true });
}

// ── Preencher <select> de meses ───────────────────────────────────
export function populateMeses(sel, valorActual) {
  const meses = ["", "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                 "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  sel.innerHTML = meses.map((m, i) =>
    i === 0
      ? `<option value="">Seleccionar mês</option>`
      : `<option value="${i}" ${valorActual == i ? "selected" : ""}>${m}</option>`
  ).join("");
}

// ── Preencher <select> de anos ────────────────────────────────────
export function populateAnos(sel, valorActual) {
  const ano = new Date().getFullYear();
  sel.innerHTML = "";
  for (let a = ano - 2; a <= ano + 1; a++) {
    const opt = document.createElement("option");
    opt.value = a; opt.textContent = a;
    if (a === (valorActual ?? ano)) opt.selected = true;
    sel.appendChild(opt);
  }
}

// ── Render de conteúdo no slot principal ──────────────────────────
export function renderPage(html) {
  document.getElementById("appContent").innerHTML = html;
}
