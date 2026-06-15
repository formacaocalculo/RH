// ================================================================
//  modules/banco-horas.js
//  Módulo: Gestão de banco de horas (entradas e saídas).
// ================================================================

import {
  listarFuncionarios, adicionarMovimentoBH,
  listarMovimentosBH, eliminarMovimentoBH, fmt,
} from "../app.js";
import { toast, spinner, openModal, closeModal, bindModalOverlay, semDados, renderPage, populateAnos } from "../ui.js";

let funcionarios = [];
let movimentos   = [];

// ── Template ─────────────────────────────────────────────────────
function html() {
  return `
    <!-- Saldo (visível apenas quando colaborador filtrado) -->
    <div id="saldoArea" style="display:none;margin-bottom:var(--sp-4)">
      <div class="saldo-bar">
        <div class="saldo-card" style="--saldo-color:var(--c-ok)">
          <div class="saldo-card__label">Horas Acumuladas</div>
          <div class="saldo-card__val" id="saldoEntradas">0h</div>
          <div class="saldo-card__sub">Total de entradas</div>
        </div>
        <div class="saldo-card" style="--saldo-color:var(--c-err)">
          <div class="saldo-card__label">Horas Utilizadas</div>
          <div class="saldo-card__val" id="saldoSaidas">0h</div>
          <div class="saldo-card__sub">Total de saídas</div>
        </div>
        <div class="saldo-card" id="saldoLiquidoCard" style="--saldo-color:var(--c-blue)">
          <div class="saldo-card__label">Saldo Disponível</div>
          <div class="saldo-card__val" id="saldoLiquido">0h</div>
          <div class="saldo-card__sub">Entradas − Saídas</div>
        </div>
      </div>
      <div class="alert" id="alertSaldo" style="display:none">
        <span class="alert__icon">ℹ️</span>
        <span id="alertSaldoMsg"></span>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card" style="margin-bottom:var(--sp-4)">
      <div class="filter-bar">
        <div class="form-group">
          <label for="fFunc">Colaborador</label>
          <select id="fFunc"><option value="">Todos</option></select>
        </div>
        <div class="form-group">
          <label for="fAno">Ano</label>
          <select id="fAno"></select>
        </div>
        <div class="form-group">
          <label for="fTipo">Tipo</label>
          <select id="fTipo">
            <option value="">Todos</option>
            <option value="entrada">Entradas (crédito)</option>
            <option value="saida">Saídas (débito)</option>
          </select>
        </div>
        <div class="form-group" style="justify-content:flex-end">
          <label>&nbsp;</label>
          <button class="btn btn--primary" id="btnFiltrar">Pesquisar</button>
        </div>
      </div>
    </div>

    <!-- Tabela -->
    <div class="card">
      <div class="card__head">
        <span class="card__title">Movimentos</span>
        <span class="badge badge--blue" id="contadorMov">0 registos</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Data</th><th>Colaborador</th><th>Tipo</th><th>Horas</th><th>Descrição</th><th>Categoria</th><th>Registado por</th><th>Acção</th></tr>
          </thead>
          <tbody id="tabelaMov">
            <tr><td colspan="8" class="empty-state">Use os filtros para pesquisar movimentos.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal -->
    <div class="modal-overlay" id="modalMov">
      <div class="modal">
        <div class="modal__head">
          <span class="modal__title">Registar Movimento</span>
          <button class="modal__close" id="modalMovFechar">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-grid">
            <div class="form-group form-group--full">
              <label for="mFunc">Colaborador *</label>
              <select id="mFunc"><option value="">Seleccionar…</option></select>
            </div>
            <div class="form-group">
              <label for="mData">Data *</label>
              <input type="date" id="mData">
            </div>
            <div class="form-group">
              <label for="mTipo">Tipo *</label>
              <select id="mTipo">
                <option value="">Seleccionar…</option>
                <option value="entrada">➕ Entrada (crédito)</option>
                <option value="saida">➖ Saída (débito)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="mHoras">Horas *</label>
              <input type="number" id="mHoras" min="0.5" max="24" step="0.5" placeholder="Ex: 2.5">
            </div>
            <div class="form-group">
              <label for="mCategoria">Categoria</label>
              <select id="mCategoria">
                <option value="">—</option>
                <option value="horas_extra">Horas Extra</option>
                <option value="folga_compensacao">Folga por Compensação</option>
                <option value="ajuste_gestao">Ajuste por Gestão</option>
                <option value="formacao">Formação</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div class="form-group form-group--full">
              <label for="mDescricao">Descrição</label>
              <input type="text" id="mDescricao" placeholder="Ex: Horas extra — reunião de projecto">
            </div>
            <div class="form-group form-group--full">
              <label for="mRegistadoPor">Registado por</label>
              <input type="text" id="mRegistadoPor" placeholder="Responsável RH">
            </div>
          </div>
        </div>
        <div class="modal__foot">
          <button class="btn btn--secondary" id="modalMovCancelar">Cancelar</button>
          <button class="btn btn--primary"   id="btnGuardarMov">Guardar</button>
        </div>
      </div>
    </div>`;
}

const LABEL_CAT = {
  horas_extra:"Horas Extra", folga_compensacao:"Folga Comp.",
  ajuste_gestao:"Ajuste Gestão", formacao:"Formação", outro:"Outro",
};

// ── Lógica ────────────────────────────────────────────────────────
async function pesquisar() {
  const funcId = document.getElementById("fFunc").value;
  const ano    = +document.getElementById("fAno").value || undefined;
  const tipo   = document.getElementById("fTipo").value;
  let lista = await listarMovimentosBH({ funcionarioId: funcId || undefined, ano });
  if (tipo) lista = lista.filter(m => m.tipo === tipo);
  movimentos = lista;
  renderTabela();
  funcId ? mostrarSaldo(funcId, lista) : (document.getElementById("saldoArea").style.display = "none");
}

function mostrarSaldo(funcId, lista) {
  const entradas = lista.filter(m => m.tipo === "entrada").reduce((a, m) => a + (m.horas ?? 0), 0);
  const saidas   = lista.filter(m => m.tipo === "saida").reduce((a, m) => a + (m.horas ?? 0), 0);
  const saldo    = entradas - saidas;
  document.getElementById("saldoEntradas").textContent = fmt.horas(entradas);
  document.getElementById("saldoSaidas").textContent   = fmt.horas(saidas);
  document.getElementById("saldoLiquido").textContent  = fmt.horas(Math.abs(saldo));
  document.getElementById("saldoArea").style.display   = "block";

  const card  = document.getElementById("saldoLiquidoCard");
  const alerta = document.getElementById("alertSaldo");
  if (saldo < 0) {
    card.style.setProperty("--saldo-color", "var(--c-err)");
    alerta.className = "alert alert--err";
    alerta.querySelector("#alertSaldoMsg").textContent = `Saldo negativo de ${fmt.horas(Math.abs(saldo))} — colaborador deve horas à empresa.`;
    alerta.style.display = "flex";
  } else {
    card.style.setProperty("--saldo-color", saldo === 0 ? "var(--c-ink-3)" : "var(--c-blue)");
    alerta.style.display = "none";
  }
}

function renderTabela() {
  const tbody = document.getElementById("tabelaMov");
  document.getElementById("contadorMov").textContent = `${movimentos.length} registo${movimentos.length !== 1 ? "s" : ""}`;
  const mapaFunc = Object.fromEntries(funcionarios.map(f => [f.id, f.nome]));
  if (!movimentos.length) { semDados(tbody, 8, "Nenhum movimento encontrado."); return; }
  tbody.innerHTML = movimentos.map(m => {
    const isE = m.tipo === "entrada";
    return `<tr>
      <td>${fmt.data(m.data)}</td>
      <td><strong>${mapaFunc[m.funcionarioId] ?? "—"}</strong></td>
      <td><span class="badge ${isE ? "badge--ok" : "badge--err"}">${isE ? "➕ Entrada" : "➖ Saída"}</span></td>
      <td class="timeline-horas ${isE ? "timeline-horas--pos" : "timeline-horas--neg"}">${isE ? "+" : "−"}${fmt.horas(m.horas ?? 0)}</td>
      <td style="font-size:.82rem">${m.descricao ?? "—"}</td>
      <td style="font-size:.75rem;color:var(--c-ink-3)">${LABEL_CAT[m.categoria] ?? "—"}</td>
      <td style="font-size:.78rem;color:var(--c-ink-3)">${m.registadoPor ?? "—"}</td>
      <td><button class="btn btn--danger btn--icon btn--sm" data-del="${m.id}" title="Eliminar">🗑️</button></td>
    </tr>`;
  }).join("");
}

async function guardar() {
  const funcId = document.getElementById("mFunc").value;
  const data   = document.getElementById("mData").value;
  const tipo   = document.getElementById("mTipo").value;
  const horas  = +document.getElementById("mHoras").value;
  if (!funcId || !data || !tipo || !horas || horas <= 0) { toast("Preencha todos os campos obrigatórios.", "err"); return; }

  const btn = document.getElementById("btnGuardarMov");
  spinner(btn, true);
  try {
    await adicionarMovimentoBH({
      funcionarioId: funcId, data,
      ano:          new Date(data).getFullYear(),
      tipo, horas,
      categoria:    document.getElementById("mCategoria").value,
      descricao:    document.getElementById("mDescricao").value.trim(),
      registadoPor: document.getElementById("mRegistadoPor").value.trim(),
    });
    toast("Movimento registado.", "ok");
    closeModal("modalMov");
    await pesquisar();
  } catch (e) {
    console.error("[banco-horas]", e);
    toast("Erro ao guardar.", "err");
  } finally {
    spinner(btn, false);
  }
}

// ── Exportação ────────────────────────────────────────────────────
export default {
  async init() {
    renderPage(html());
    populateAnos(document.getElementById("fAno"));

    funcionarios = await listarFuncionarios();
    const opts = funcionarios.map(f => `<option value="${f.id}">${f.nome}</option>`).join("");
    document.getElementById("fFunc").innerHTML  += opts;
    document.getElementById("mFunc").innerHTML  += opts;
    document.getElementById("mData").value = new Date().toISOString().split("T")[0];

    // Botão topbar
    const btnNovo = document.getElementById("btnNovoMov");
    const abrirModal = () => {
      ["mFunc","mTipo","mHoras","mCategoria","mDescricao","mRegistadoPor"].forEach(id => {
        document.getElementById(id).value = "";
      });
      document.getElementById("mData").value = new Date().toISOString().split("T")[0];
      openModal("modalMov");
    };
    btnNovo?.addEventListener("click", abrirModal);

    document.getElementById("modalMovFechar").addEventListener("click",   () => closeModal("modalMov"));
    document.getElementById("modalMovCancelar").addEventListener("click", () => closeModal("modalMov"));
    bindModalOverlay("modalMov");
    document.getElementById("btnGuardarMov").addEventListener("click", guardar);
    document.getElementById("btnFiltrar").addEventListener("click", pesquisar);

    // Delegação: eliminar
    document.getElementById("tabelaMov").addEventListener("click", async e => {
      const btn = e.target.closest("[data-del]");
      if (!btn) return;
      if (!confirm("Eliminar este movimento?")) return;
      try {
        await eliminarMovimentoBH(btn.dataset.del);
        toast("Movimento eliminado.", "ok");
        await pesquisar();
      } catch { toast("Erro ao eliminar.", "err"); }
    });

    await pesquisar();
    return () => { funcionarios = []; movimentos = []; btnNovo?.removeEventListener("click", abrirModal); };
  },
};
