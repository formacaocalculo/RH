// ================================================================
//  modules/ferias.js
//  Módulo: Gestão de pedidos de férias com workflow de aprovação.
// ================================================================

import {
  listarFuncionarios, adicionarPedidoFerias, listarFerias,
  actualizarEstadoFerias, eliminarPedidoFerias, fmt,
} from "../app.js";
import { toast, spinner, openModal, closeModal, bindModalOverlay, semDados, renderPage, populateAnos } from "../ui.js";

let funcionarios     = [];
let pedidos          = [];
let pendingRejeicaoId = null;

// ── Template ─────────────────────────────────────────────────────
function html() {
  return `
    <!-- Saldo -->
    <div id="saldoFeriasArea" style="display:none;margin-bottom:var(--sp-4)">
      <div class="saldo-bar">
        <div class="saldo-card" style="--saldo-color:var(--c-blue)">
          <div class="saldo-card__label">Direito Anual</div>
          <div class="saldo-card__val" id="sfDireito">22</div>
          <div class="saldo-card__sub">dias úteis (base legal)</div>
        </div>
        <div class="saldo-card" style="--saldo-color:var(--c-ok)">
          <div class="saldo-card__label">Aprovados</div>
          <div class="saldo-card__val" id="sfAprovados">0</div>
          <div class="saldo-card__sub">dias aprovados</div>
        </div>
        <div class="saldo-card" style="--saldo-color:var(--c-amber)">
          <div class="saldo-card__label">Pendentes</div>
          <div class="saldo-card__val" id="sfPendentes">0</div>
          <div class="saldo-card__sub">a aguardar aprovação</div>
        </div>
        <div class="saldo-card" id="sfSaldoCard" style="--saldo-color:var(--c-blue)">
          <div class="saldo-card__label">Disponível</div>
          <div class="saldo-card__val" id="sfSaldo">22</div>
          <div class="saldo-card__sub">dias restantes</div>
        </div>
      </div>
      <div class="alert" id="alertSaldoFerias" style="display:none">
        <span class="alert__icon">⚠️</span>
        <span id="alertSaldoFeriasMsg"></span>
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
          <label for="fEstado">Estado</label>
          <select id="fEstado">
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="aprovado">Aprovado</option>
            <option value="rejeitado">Rejeitado</option>
            <option value="cancelado">Cancelado</option>
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
        <span class="card__title">Pedidos de Férias</span>
        <span class="badge badge--blue" id="contadorFerias">0 registos</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Colaborador</th><th>Início</th><th>Fim</th><th>Dias Úteis</th><th>Ano</th><th>Nota</th><th>Estado</th><th>Acções</th></tr>
          </thead>
          <tbody id="tabelaFerias">
            <tr><td colspan="8" class="empty-state">Use os filtros para pesquisar pedidos.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal: Novo pedido -->
    <div class="modal-overlay" id="modalFerias">
      <div class="modal">
        <div class="modal__head">
          <span class="modal__title">Novo Pedido de Férias</span>
          <button class="modal__close" id="modalFeriasFechar">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-grid">
            <div class="form-group form-group--full">
              <label for="fFuncModal">Colaborador *</label>
              <select id="fFuncModal"><option value="">Seleccionar…</option></select>
            </div>
            <div class="form-group">
              <label for="fDataInicio">Data de Início *</label>
              <input type="date" id="fDataInicio">
            </div>
            <div class="form-group">
              <label for="fDataFim">Data de Fim *</label>
              <input type="date" id="fDataFim">
            </div>
            <div class="form-group">
              <label for="fDiasUteis">Dias Úteis *</label>
              <input type="number" id="fDiasUteis" min="1" max="30" step="1">
              <span class="hint">Excluir fins-de-semana e feriados</span>
            </div>
            <div class="form-group">
              <label for="fAnoModal">Ano de imputação *</label>
              <select id="fAnoModal"></select>
            </div>
            <div class="form-group form-group--full">
              <label for="fNota">Nota</label>
              <input type="text" id="fNota" placeholder="Ex: Férias de Verão">
            </div>
          </div>
          <div class="alert alert--info" style="margin-top:var(--sp-4)">
            <span class="alert__icon">💡</span>
            <span>Os dias úteis são calculados automaticamente (excl. sábados e domingos), mas ajuste manualmente para feriados.</span>
          </div>
        </div>
        <div class="modal__foot">
          <button class="btn btn--secondary" id="modalFeriasCancelar">Cancelar</button>
          <button class="btn btn--primary"   id="btnGuardarFerias">Submeter Pedido</button>
        </div>
      </div>
    </div>

    <!-- Modal: Rejeição -->
    <div class="modal-overlay" id="modalRejeicao">
      <div class="modal" style="max-width:420px">
        <div class="modal__head">
          <span class="modal__title">Rejeitar Pedido</span>
          <button class="modal__close" id="modalRejeicaoFechar">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label for="motivoRejeicao">Motivo da rejeição *</label>
            <input type="text" id="motivoRejeicao" placeholder="Indique o motivo…">
          </div>
        </div>
        <div class="modal__foot">
          <button class="btn btn--secondary" id="modalRejeicaoCancelar">Cancelar</button>
          <button class="btn btn--danger"    id="btnConfirmarRejeicao">Rejeitar</button>
        </div>
      </div>
    </div>`;
}

// ── Lógica ────────────────────────────────────────────────────────
async function pesquisar() {
  const funcId = document.getElementById("fFunc").value;
  const ano    = document.getElementById("fAno").value;
  const estado = document.getElementById("fEstado").value;
  pedidos = await listarFerias({
    funcionarioId: funcId  || undefined,
    ano:           ano     ? +ano    : undefined,
    estado:        estado  || undefined,
  });
  renderTabela();
  funcId
    ? mostrarSaldo(funcId, +ano || new Date().getFullYear())
    : (document.getElementById("saldoFeriasArea").style.display = "none");
}

async function mostrarSaldo(funcId, ano) {
  const todos     = await listarFerias({ funcionarioId: funcId, ano });
  const aprovados = todos.filter(p => p.estado === "aprovado").reduce((a, p) => a + (p.diasUteis ?? 0), 0);
  const pendentes = todos.filter(p => p.estado === "pendente").reduce((a, p) => a + (p.diasUteis ?? 0), 0);
  const saldo     = 22 - aprovados;
  document.getElementById("sfDireito").textContent   = 22;
  document.getElementById("sfAprovados").textContent = aprovados;
  document.getElementById("sfPendentes").textContent = pendentes;
  document.getElementById("sfSaldo").textContent     = saldo;
  document.getElementById("saldoFeriasArea").style.display = "block";

  const card    = document.getElementById("sfSaldoCard");
  const alerta  = document.getElementById("alertSaldoFerias");
  const alertMsg = document.getElementById("alertSaldoFeriasMsg");
  if (saldo < 0) {
    card.style.setProperty("--saldo-color", "var(--c-err)");
    alerta.className = "alert alert--err";
    alertMsg.textContent = `Excedido em ${Math.abs(saldo)} dias o direito anual.`;
    alerta.style.display = "flex";
  } else if (saldo <= 5) {
    card.style.setProperty("--saldo-color", "var(--c-amber)");
    alerta.className = "alert alert--warn";
    alertMsg.textContent = `Restam apenas ${saldo} dias disponíveis em ${ano}.`;
    alerta.style.display = "flex";
  } else {
    card.style.setProperty("--saldo-color", "var(--c-ok)");
    alerta.style.display = "none";
  }
}

function renderTabela() {
  const tbody = document.getElementById("tabelaFerias");
  document.getElementById("contadorFerias").textContent = `${pedidos.length} registo${pedidos.length !== 1 ? "s" : ""}`;
  const mapaFunc = Object.fromEntries(funcionarios.map(f => [f.id, f.nome]));
  if (!pedidos.length) { semDados(tbody, 8, "Nenhum pedido encontrado."); return; }

  const badgeClass = { pendente:"badge--pendente", aprovado:"badge--aprovado", rejeitado:"badge--rejeitado", cancelado:"badge--cancelado" };
  const labelEst   = { pendente:"Pendente", aprovado:"Aprovado ✓", rejeitado:"Rejeitado ✗", cancelado:"Cancelado" };

  tbody.innerHTML = pedidos.map(p => {
    const acoes = p.estado === "pendente"
      ? `<button class="btn btn--sm btn--primary" data-aprovar="${p.id}">✓ Aprovar</button>
         <button class="btn btn--sm btn--danger"  data-rejeitar="${p.id}">✗ Rejeitar</button>`
      : `<button class="btn btn--danger btn--icon btn--sm" data-del="${p.id}" title="Eliminar">🗑️</button>`;
    return `<tr>
      <td><strong>${mapaFunc[p.funcionarioId] ?? "—"}</strong></td>
      <td>${fmt.data(p.dataInicio)}</td>
      <td>${fmt.data(p.dataFim)}</td>
      <td style="text-align:center;font-weight:700">${p.diasUteis ?? "—"}</td>
      <td>${p.ano ?? "—"}</td>
      <td style="font-size:.82rem;color:var(--c-ink-2)">${p.nota ?? "—"}
        ${p.observacao ? `<br><span style="color:var(--c-err);font-size:.75rem">Nota: ${p.observacao}</span>` : ""}
      </td>
      <td><span class="badge ${badgeClass[p.estado] ?? "badge--blue"}">${labelEst[p.estado] ?? p.estado}</span></td>
      <td><div class="action-cell">${acoes}</div></td>
    </tr>`;
  }).join("");
}

// ── Exportação ────────────────────────────────────────────────────
export default {
  async init() {
    renderPage(html());
    populateAnos(document.getElementById("fAno"));
    populateAnos(document.getElementById("fAnoModal"));

    funcionarios = await listarFuncionarios();
    const opts = funcionarios.map(f => `<option value="${f.id}">${f.nome}</option>`).join("");
    document.getElementById("fFunc").innerHTML      += opts;
    document.getElementById("fFuncModal").innerHTML += opts;

    // Auto-cálculo dias úteis
    const calcDias = () => {
      const ini = new Date(document.getElementById("fDataInicio").value);
      const fim = new Date(document.getElementById("fDataFim").value);
      if (isNaN(ini) || isNaN(fim) || fim < ini) return;
      let dias = 0, cur = new Date(ini);
      while (cur <= fim) { const d = cur.getDay(); if (d !== 0 && d !== 6) dias++; cur.setDate(cur.getDate()+1); }
      document.getElementById("fDiasUteis").value = dias;
    };
    document.getElementById("fDataInicio").addEventListener("change", calcDias);
    document.getElementById("fDataFim").addEventListener("change", calcDias);

    // Botão topbar
    const btnNovo = document.getElementById("btnNovoPedido");
    const abrirNovo = () => {
      ["fFuncModal","fDataInicio","fDataFim","fDiasUteis","fNota"].forEach(id => document.getElementById(id).value = "");
      openModal("modalFerias");
    };
    btnNovo?.addEventListener("click", abrirNovo);

    document.getElementById("modalFeriasFechar").addEventListener("click",   () => closeModal("modalFerias"));
    document.getElementById("modalFeriasCancelar").addEventListener("click", () => closeModal("modalFerias"));
    document.getElementById("modalRejeicaoFechar").addEventListener("click",   () => closeModal("modalRejeicao"));
    document.getElementById("modalRejeicaoCancelar").addEventListener("click", () => closeModal("modalRejeicao"));
    bindModalOverlay("modalFerias");
    bindModalOverlay("modalRejeicao");

    document.getElementById("btnGuardarFerias").addEventListener("click", async () => {
      const funcId    = document.getElementById("fFuncModal").value;
      const dataInicio = document.getElementById("fDataInicio").value;
      const dataFim    = document.getElementById("fDataFim").value;
      const diasUteis  = +document.getElementById("fDiasUteis").value;
      const ano        = +document.getElementById("fAnoModal").value;
      if (!funcId || !dataInicio || !dataFim || !diasUteis || !ano) { toast("Preencha todos os campos.", "err"); return; }
      if (new Date(dataFim) < new Date(dataInicio)) { toast("Data de fim anterior ao início.", "err"); return; }
      const btn = document.getElementById("btnGuardarFerias");
      spinner(btn, true);
      try {
        await adicionarPedidoFerias({ funcionarioId: funcId, dataInicio, dataFim, diasUteis, ano, nota: document.getElementById("fNota").value.trim() });
        toast("Pedido submetido.", "ok");
        closeModal("modalFerias");
        await pesquisar();
      } catch (e) { console.error(e); toast("Erro ao guardar.", "err"); }
      finally { spinner(btn, false); }
    });

    document.getElementById("btnConfirmarRejeicao").addEventListener("click", async () => {
      const motivo = document.getElementById("motivoRejeicao").value.trim();
      if (!motivo) { toast("Indique o motivo.", "err"); return; }
      try {
        await actualizarEstadoFerias(pendingRejeicaoId, "rejeitado", motivo);
        toast("Pedido rejeitado.", "ok");
        closeModal("modalRejeicao");
        pendingRejeicaoId = null;
        await pesquisar();
      } catch { toast("Erro ao rejeitar.", "err"); }
    });

    document.getElementById("btnFiltrar").addEventListener("click", pesquisar);

    // Delegação na tabela
    document.getElementById("tabelaFerias").addEventListener("click", async e => {
      const aprovar  = e.target.closest("[data-aprovar]");
      const rejeitar = e.target.closest("[data-rejeitar]");
      const del      = e.target.closest("[data-del]");
      if (aprovar) {
        if (!confirm("Aprovar este pedido?")) return;
        try { await actualizarEstadoFerias(aprovar.dataset.aprovar, "aprovado"); toast("Aprovado.", "ok"); await pesquisar(); }
        catch { toast("Erro ao aprovar.", "err"); }
      }
      if (rejeitar) {
        pendingRejeicaoId = rejeitar.dataset.rejeitar;
        document.getElementById("motivoRejeicao").value = "";
        openModal("modalRejeicao");
      }
      if (del) {
        if (!confirm("Eliminar este pedido?")) return;
        try { await eliminarPedidoFerias(del.dataset.del); toast("Eliminado.", "ok"); await pesquisar(); }
        catch { toast("Erro ao eliminar.", "err"); }
      }
    });

    await pesquisar();
    return () => {
      funcionarios = []; pedidos = []; pendingRejeicaoId = null;
      btnNovo?.removeEventListener("click", abrirNovo);
    };
  },
};
