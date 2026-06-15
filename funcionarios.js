// ================================================================
//  modules/funcionarios.js
//  Módulo: CRUD completo de colaboradores.
// ================================================================

import {
  adicionarFuncionario, listarFuncionarios,
  actualizarFuncionario, eliminarFuncionario, fmt,
} from "../app.js";
import { toast, spinner, openModal, closeModal, bindModalOverlay, semDados, renderPage } from "../ui.js";

// ── Estado interno do módulo ─────────────────────────────────────
let funcionarios = [];
let editandoId   = null;

// ── Template HTML ─────────────────────────────────────────────────
function html() {
  return `
    <!-- Filtro rápido -->
    <div class="card" style="margin-bottom:var(--sp-4)">
      <div class="filter-bar">
        <div class="form-group">
          <label for="pesquisaFunc">Pesquisar</label>
          <input type="text" id="pesquisaFunc" placeholder="Nome ou NIF…">
        </div>
        <div class="form-group" style="justify-content:flex-end">
          <label>&nbsp;</label>
          <span class="badge badge--blue" id="contadorFunc">0 registos</span>
        </div>
      </div>
    </div>

    <!-- Tabela -->
    <div class="card">
      <div class="card__head">
        <span class="card__title">Lista de Colaboradores</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th><th>NIF</th><th>IBAN</th>
              <th>Categoria</th><th>Salário Base</th><th>Data Entrada</th><th>Acções</th>
            </tr>
          </thead>
          <tbody id="tabelaFuncionarios">
            <tr><td colspan="7" class="empty-state">A carregar…</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal -->
    <div class="modal-overlay" id="modalFunc">
      <div class="modal">
        <div class="modal__head">
          <span class="modal__title" id="modalFuncTitulo">Novo Colaborador</span>
          <button class="modal__close" id="modalFuncFechar">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-grid">
            <div class="form-group form-group--full">
              <label for="fNome">Nome completo *</label>
              <input type="text" id="fNome" placeholder="Ex: Maria João Silva">
              <span class="field-error" id="errNome">Campo obrigatório</span>
            </div>
            <div class="form-group">
              <label for="fNif">NIF *</label>
              <input type="text" id="fNif" placeholder="123456789" maxlength="9">
              <span class="field-error" id="errNif">NIF inválido (9 dígitos)</span>
            </div>
            <div class="form-group">
              <label for="fSS">N.º Segurança Social</label>
              <input type="text" id="fSS" placeholder="12345678901" maxlength="11">
            </div>
            <div class="form-group form-group--full">
              <label for="fIban">IBAN *</label>
              <input type="text" id="fIban" placeholder="PT50 0000 0000 0000 0000 0000 0">
              <span class="field-error" id="errIban">IBAN inválido</span>
            </div>
            <div class="form-group">
              <label for="fSalario">Salário Base (€) *</label>
              <input type="number" id="fSalario" placeholder="1100.00" min="820" step="0.01">
              <span class="hint">Mínimo nacional: 820 €</span>
              <span class="field-error" id="errSalario">Valor inválido</span>
            </div>
            <div class="form-group">
              <label for="fCategoria">Categoria / Função</label>
              <select id="fCategoria">
                <option value="">Seleccionar…</option>
                <option>Administrativo</option><option>Técnico</option>
                <option>Comercial</option><option>Gestão</option>
                <option>Operacional</option><option>Outro</option>
              </select>
            </div>
            <div class="form-group">
              <label for="fDataEntrada">Data de Entrada</label>
              <input type="date" id="fDataEntrada">
            </div>
            <div class="form-group">
              <label for="fEmail">E-mail</label>
              <input type="email" id="fEmail" placeholder="colaborador@empresa.pt">
            </div>
          </div>
        </div>
        <div class="modal__foot">
          <button class="btn btn--secondary" id="modalFuncCancelar">Cancelar</button>
          <button class="btn btn--primary"   id="btnGuardarFunc">Guardar</button>
        </div>
      </div>
    </div>`;
}

// ── Funções de dados ─────────────────────────────────────────────
async function carregar() {
  funcionarios = await listarFuncionarios();
  renderizar(funcionarios);
}

function renderizar(lista) {
  const tbody = document.getElementById("tabelaFuncionarios");
  document.getElementById("contadorFunc").textContent =
    `${lista.length} registo${lista.length !== 1 ? "s" : ""}`;

  if (!lista.length) {
    semDados(tbody, 7, "Nenhum colaborador. Clique em «Novo Colaborador» para começar.");
    return;
  }
  tbody.innerHTML = lista.map(f => `
    <tr data-id="${f.id}">
      <td><strong>${f.nome}</strong></td>
      <td><code>${f.nif ?? "—"}</code></td>
      <td><code style="font-size:.78rem">${fmtIban(f.iban ?? "")}</code></td>
      <td>${f.categoria ? `<span class="badge badge--blue">${f.categoria}</span>` : "—"}</td>
      <td><strong>${fmt.euros(f.salarioBase)}</strong></td>
      <td>${f.dataEntrada ? new Date(f.dataEntrada).toLocaleDateString("pt-PT") : "—"}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn--secondary btn--icon btn--sm" data-edit="${f.id}" title="Editar">✏️</button>
          <button class="btn btn--danger    btn--icon btn--sm" data-del="${f.id}"  title="Eliminar">🗑️</button>
        </div>
      </td>
    </tr>`).join("");
}

function fmtIban(iban) {
  return iban.replace(/[^A-Z0-9]/gi, "").replace(/(.{4})/g, "$1 ").trim().toUpperCase() || "—";
}

// ── Modal helpers ─────────────────────────────────────────────────
function abrirNovo() {
  editandoId = null;
  limparForm();
  document.getElementById("modalFuncTitulo").textContent = "Novo Colaborador";
  openModal("modalFunc");
}

function abrirEditar(id) {
  editandoId = id;
  const f = funcionarios.find(x => x.id === id);
  if (!f) return;
  document.getElementById("fNome").value        = f.nome ?? "";
  document.getElementById("fNif").value         = f.nif ?? "";
  document.getElementById("fSS").value          = f.numeross ?? "";
  document.getElementById("fIban").value        = f.iban ?? "";
  document.getElementById("fSalario").value     = f.salarioBase ?? "";
  document.getElementById("fCategoria").value   = f.categoria ?? "";
  document.getElementById("fDataEntrada").value = f.dataEntrada ?? "";
  document.getElementById("fEmail").value       = f.email ?? "";
  document.getElementById("modalFuncTitulo").textContent = "Editar Colaborador";
  openModal("modalFunc");
}

function limparForm() {
  ["fNome","fNif","fSS","fIban","fSalario","fCategoria","fDataEntrada","fEmail"]
    .forEach(id => { const el = document.getElementById(id); el.value = ""; el.classList.remove("invalid"); });
}

function validar() {
  let ok = true;
  const chk = (id, cond) => {
    document.getElementById(id).classList.toggle("invalid", !cond);
    if (!cond) ok = false;
  };
  chk("fNome",    document.getElementById("fNome").value.trim().length > 1);
  chk("fNif",     /^\d{9}$/.test(document.getElementById("fNif").value.trim()));
  chk("fIban",    document.getElementById("fIban").value.replace(/\s/g,"").length >= 15);
  chk("fSalario", +document.getElementById("fSalario").value >= 820);
  return ok;
}

// ── Guardar ───────────────────────────────────────────────────────
async function guardar() {
  if (!validar()) return;
  const btn = document.getElementById("btnGuardarFunc");
  spinner(btn, true);
  const dados = {
    nome:        document.getElementById("fNome").value.trim(),
    nif:         document.getElementById("fNif").value.trim(),
    numeross:    document.getElementById("fSS").value.trim(),
    iban:        document.getElementById("fIban").value.replace(/\s/g,"").toUpperCase(),
    salarioBase: +document.getElementById("fSalario").value,
    categoria:   document.getElementById("fCategoria").value,
    dataEntrada: document.getElementById("fDataEntrada").value,
    email:       document.getElementById("fEmail").value.trim(),
  };
  try {
    if (editandoId) {
      await actualizarFuncionario(editandoId, dados);
      toast("Colaborador actualizado.", "ok");
    } else {
      await adicionarFuncionario(dados);
      toast("Colaborador adicionado.", "ok");
    }
    closeModal("modalFunc");
    await carregar();
  } catch (e) {
    console.error("[funcionarios]", e);
    toast("Erro ao guardar. Verifique o Firebase.", "err");
  } finally {
    spinner(btn, false);
  }
}

// ── Eliminar ──────────────────────────────────────────────────────
async function eliminar(id) {
  if (!confirm("Eliminar este colaborador? Esta acção não pode ser revertida.")) return;
  try {
    await eliminarFuncionario(id);
    toast("Colaborador eliminado.", "ok");
    await carregar();
  } catch {
    toast("Erro ao eliminar.", "err");
  }
}

// ── Registo de eventos (devolvidos para cleanup) ──────────────────
function bindEvents() {
  // Botão Novo na topbar (injectado pelo router)
  const btnNovo = document.getElementById("btnNovoFunc");
  btnNovo?.addEventListener("click", abrirNovo);

  // Fechar modal
  document.getElementById("modalFuncFechar")?.addEventListener("click",   () => closeModal("modalFunc"));
  document.getElementById("modalFuncCancelar")?.addEventListener("click", () => closeModal("modalFunc"));
  bindModalOverlay("modalFunc");

  // Guardar
  document.getElementById("btnGuardarFunc")?.addEventListener("click", guardar);

  // Pesquisa
  document.getElementById("pesquisaFunc")?.addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    renderizar(funcionarios.filter(f =>
      f.nome.toLowerCase().includes(q) || (f.nif ?? "").includes(q)
    ));
  });

  // Delegação: editar / eliminar na tabela
  const tbody = document.getElementById("tabelaFuncionarios");
  const onTableClick = e => {
    const editBtn = e.target.closest("[data-edit]");
    const delBtn  = e.target.closest("[data-del]");
    if (editBtn) abrirEditar(editBtn.dataset.edit);
    if (delBtn)  eliminar(delBtn.dataset.del);
  };
  tbody?.addEventListener("click", onTableClick);

  // cleanup: remover referências externas
  return () => {
    btnNovo?.removeEventListener("click", abrirNovo);
    tbody?.removeEventListener("click", onTableClick);
    funcionarios = [];
    editandoId   = null;
  };
}

// ── Exportação ────────────────────────────────────────────────────
export default {
  async init() {
    renderPage(html());
    const cleanup = bindEvents();
    await carregar();
    return cleanup;
  },
};
