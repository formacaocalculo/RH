// ================================================================
//  modules/faltas.js
//  Módulo: Registo e gestão de faltas (justificadas / injustificadas).
// ================================================================

import {
  listarFuncionarios, adicionarFalta,
  listarFaltas, actualizarFalta, eliminarFalta, fmt,
} from "../app.js";
import { toast, spinner, openModal, closeModal, bindModalOverlay, semDados, renderPage, populateAnos } from "../ui.js";

let funcionarios = [];
let faltas       = [];
let editandoId   = null;

const TIPOS = {
  justificada:   { label: "Justificada",    badge: "badge--justificada" },
  injustificada: { label: "Injustificada",  badge: "badge--injustificada" },
  medica:        { label: "Médica / Baixa", badge: "badge--medica" },
  outra:         { label: "Outra",          badge: "badge--outra" },
};

const MESES_LABEL = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                     "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ── Template ─────────────────────────────────────────────────────
function html() {
  const optsMeses = MESES_LABEL.map((m, i) =>
    i === 0 ? `<option value="">Todos os meses</option>`
            : `<option value="${i}">${m}</option>`
  ).join("");

  return `
    <!-- Resumo (quando colaborador filtrado) -->
    <div id="resumoFaltasArea" style="display:none;margin-bottom:var(--sp-4)">
      <div class="saldo-bar">
        <div class="saldo-card" style="--saldo-color:var(--c-ink)">
          <div class="saldo-card__label">Total de Faltas</div>
          <div class="saldo-card__val" id="rfTotal">0</div>
          <div class="saldo-card__sub">dias no período</div>
        </div>
        <div class="saldo-card" style="--saldo-color:var(--c-blue)">
          <div class="saldo-card__label">Justificadas</div>
          <div class="saldo-card__val" id="rfJust">0</div>
          <div class="saldo-card__sub">com justificação</div>
        </div>
        <div class="saldo-card" style="--saldo-color:var(--c-err)">
          <div class="saldo-card__label">Injustificadas</div>
          <div class="saldo-card__val" id="rfInjust">0</div>
          <div class="saldo-card__sub">sem justificação</div>
        </div>
        <div class="saldo-card" style="--saldo-color:var(--c-amber)">
          <div class="saldo-card__label">Impacto Salarial</div>
          <div class="saldo-card__val" id="rfImpacto" style="font-size:1.2rem">—</div>
          <div class="saldo-card__sub" id="rfImpactoSub">faltas injustificadas</div>
        </div>
      </div>
      <div class="alert" id="alertFaltas" style="display:none">
        <span class="alert__icon">⚠️</span>
        <span id="alertFaltasMsg"></span>
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
          <label for="fMesFiltro">Mês</label>
          <select id="fMesFiltro">${optsMeses}</select>
        </div>
        <div class="form-group">
          <label for="fTipo">Tipo</label>
          <select id="fTipo">
            <option value="">Todos</option>
            <option value="justificada">Justificada</option>
            <option value="injustificada">Injustificada</option>
            <option value="medica">Médica / Baixa</option>
            <option value="outra">Outra</option>
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
        <span class="card__title">Registo de Faltas</span>
        <span class="badge badge--blue" id="contadorFaltas">0 registos</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Colaborador</th><th>Data</th><th>Dias</th><th>Tipo</th><th>Motivo</th><th>Documento</th><th>Impacto</th><th>Regist. por</th><th>Acções</th></tr>
          </thead>
          <tbody id="tabelaFaltas">
            <tr><td colspan="9" class="empty-state">Use os filtros para pesquisar faltas.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div style="margin-top:var(--sp-4);display:flex;gap:var(--sp-3);flex-wrap:wrap;font-size:.78rem;color:var(--c-ink-3)">
      <span>Tipos:</span>
      ${Object.entries(TIPOS).map(([,{label,badge}]) => `<span class="badge ${badge}">${label}</span>`).join("")}
      <span style="margin-left:var(--sp-2)">⚡ Apenas as <strong>injustificadas</strong> implicam desconto salarial (art.º 256.º CT).</span>
    </div>

    <!-- Modal: Falta -->
    <div class="modal-overlay" id="modalFalta">
      <div class="modal" style="max-width:620px">
        <div class="modal__head">
          <span class="modal__title" id="modalFaltaTitulo">Registar Falta</span>
          <button class="modal__close" id="modalFaltaFechar">✕</button>
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
              <label for="mDias">Dias *</label>
              <input type="number" id="mDias" min="0.5" max="30" step="0.5" value="1">
              <span class="hint">Meio dia = 0.5</span>
            </div>
            <div class="form-group">
              <label for="mTipo">Tipo *</label>
              <select id="mTipo">
                <option value="">Seleccionar…</option>
                <option value="justificada">✅ Justificada</option>
                <option value="injustificada">❌ Injustificada</option>
                <option value="medica">🏥 Médica / Baixa</option>
                <option value="outra">📋 Outra</option>
              </select>
            </div>
            <div class="form-group form-group--full">
              <label for="mMotivo">Motivo</label>
              <input type="text" id="mMotivo" placeholder="Ex: Consulta médica, doença…">
            </div>
            <div class="form-group form-group--full">
              <label for="mDocumento">Referência do documento justificativo</label>
              <input type="text" id="mDocumento" placeholder="Ex: CIT n.º 12345 / Declaração médica">
              <span class="hint">Obrigatório para justificadas e médicas</span>
            </div>
            <div class="form-group form-group--full">
              <label for="mRegistadoPor">Registado por</label>
              <input type="text" id="mRegistadoPor" placeholder="Responsável RH">
            </div>
          </div>
          <div class="alert alert--err"  id="avisoInj"  style="display:none;margin-top:var(--sp-4)">
            <span class="alert__icon">⚠️</span>
            <span>Falta <strong>injustificada</strong>: desconto de salário ÷ 22 × nº dias no processamento mensal.</span>
          </div>
          <div class="alert alert--info" id="avisoMed"  style="display:none;margin-top:var(--sp-4)">
            <span class="alert__icon">🏥</span>
            <span>Falta <strong>médica / baixa</strong>: os primeiros 3 dias são habitualmente da responsabilidade da entidade patronal. A partir do 4.º dia, a SS pode subsidiar.</span>
          </div>
        </div>
        <div class="modal__foot">
          <button class="btn btn--secondary" id="modalFaltaCancelar">Cancelar</button>
          <button class="btn btn--primary"   id="btnGuardarFalta">Guardar</button>
        </div>
      </div>
    </div>`;
}

// ── Lógica ────────────────────────────────────────────────────────
async function pesquisar() {
  const funcId = document.getElementById("fFunc").value;
  const ano    = document.getElementById("fAno").value;
  const mes    = document.getElementById("fMesFiltro").value;
  const tipo   = document.getElementById("fTipo").value;
  let lista = await listarFaltas({ funcionarioId: funcId || undefined, ano: ano ? +ano : undefined, tipo: tipo || undefined });
  if (mes) lista = lista.filter(f => +f.mes === +mes);
  faltas = lista;
  renderTabela();
  funcId ? mostrarResumo(funcId, lista) : (document.getElementById("resumoFaltasArea").style.display = "none");
}

function mostrarResumo(funcId, lista) {
  const func  = funcionarios.find(f => f.id === funcId);
  const total  = lista.reduce((a, f) => a + (f.dias ?? 0), 0);
  const just   = lista.filter(f => f.tipo === "justificada" || f.tipo === "medica").reduce((a, f) => a + (f.dias ?? 0), 0);
  const injust = lista.filter(f => f.tipo === "injustificada").reduce((a, f) => a + (f.dias ?? 0), 0);
  const impacto = func?.salarioBase ? (func.salarioBase / 22) * injust : null;

  document.getElementById("rfTotal").textContent      = total;
  document.getElementById("rfJust").textContent       = just;
  document.getElementById("rfInjust").textContent     = injust;
  document.getElementById("rfImpacto").textContent    = impacto !== null ? fmt.euros(impacto) : "—";
  document.getElementById("rfImpactoSub").textContent = injust > 0 ? `estimado (${injust}d inj.)` : "sem desconto";
  document.getElementById("resumoFaltasArea").style.display = "block";

  const alerta   = document.getElementById("alertFaltas");
  const alertMsg = document.getElementById("alertFaltasMsg");
  if (injust >= 5) {
    alerta.className = "alert alert--err"; alerta.style.display = "flex";
    alertMsg.textContent = `${injust} falta(s) injustificada(s) — atenção: 5 consecutivas ou 10 interpoladas/ano podem constituir justa causa de despedimento (art.º 351.º CT).`;
  } else if (injust > 0) {
    alerta.className = "alert alert--warn"; alerta.style.display = "flex";
    alertMsg.textContent = `${injust} falta(s) injustificada(s) — desconto estimado de ${impacto !== null ? fmt.euros(impacto) : "—"}.`;
  } else {
    alerta.style.display = "none";
  }
}

function renderTabela() {
  const tbody = document.getElementById("tabelaFaltas");
  document.getElementById("contadorFaltas").textContent = `${faltas.length} registo${faltas.length !== 1 ? "s" : ""}`;
  const mapaFunc = Object.fromEntries(funcionarios.map(f => [f.id, f]));
  if (!faltas.length) { semDados(tbody, 9, "Nenhuma falta encontrada."); return; }

  tbody.innerHTML = faltas.map(f => {
    const func    = mapaFunc[f.funcionarioId];
    const tipoInfo = TIPOS[f.tipo] ?? { label: f.tipo ?? "—", badge: "badge--blue" };
    const impacto  = f.tipo === "injustificada" && func?.salarioBase
      ? fmt.euros((func.salarioBase / 22) * (f.dias ?? 1)) : "—";
    return `<tr>
      <td><strong>${func?.nome ?? "—"}</strong></td>
      <td>${fmt.data(f.data)}</td>
      <td style="text-align:center;font-weight:700">${f.dias ?? 1}</td>
      <td><span class="badge ${tipoInfo.badge}">${tipoInfo.label}</span></td>
      <td style="font-size:.82rem">${f.motivo ?? "—"}</td>
      <td style="font-size:.78rem;color:var(--c-ink-3)">${f.documento ?? "—"}</td>
      <td style="font-family:var(--font-mono);font-size:.82rem;font-weight:700;color:${f.tipo==="injustificada"?"var(--c-err)":"var(--c-ok)"}">${impacto}</td>
      <td style="font-size:.78rem;color:var(--c-ink-3)">${f.registadoPor ?? "—"}</td>
      <td>
        <div class="action-cell">
          <button class="btn btn--secondary btn--icon btn--sm" data-edit="${f.id}" title="Editar">✏️</button>
          <button class="btn btn--danger    btn--icon btn--sm" data-del="${f.id}"  title="Eliminar">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

function abrirEditar(id) {
  editandoId = id;
  const f = faltas.find(x => x.id === id);
  if (!f) return;
  document.getElementById("mFunc").value         = f.funcionarioId ?? "";
  document.getElementById("mData").value         = f.data ?? "";
  document.getElementById("mDias").value         = f.dias ?? 1;
  document.getElementById("mTipo").value         = f.tipo ?? "";
  document.getElementById("mMotivo").value       = f.motivo ?? "";
  document.getElementById("mDocumento").value    = f.documento ?? "";
  document.getElementById("mRegistadoPor").value = f.registadoPor ?? "";
  document.getElementById("modalFaltaTitulo").textContent = "Editar Falta";
  actualizarAvisos(f.tipo);
  openModal("modalFalta");
}

function actualizarAvisos(tipo) {
  document.getElementById("avisoInj").style.display = tipo === "injustificada" ? "flex" : "none";
  document.getElementById("avisoMed").style.display = tipo === "medica"        ? "flex" : "none";
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

    // Avisos dinâmicos
    document.getElementById("mTipo").addEventListener("change", e => actualizarAvisos(e.target.value));

    // Auto-preencher mes/ano ao seleccionar data
    document.getElementById("mData").addEventListener("change", e => {
      const d = new Date(e.target.value);
      if (!isNaN(d)) {
        document.getElementById("mData")._ano = d.getFullYear();
        document.getElementById("mData")._mes = d.getMonth() + 1;
      }
    });

    // Botão topbar
    const btnNova = document.getElementById("btnNovaFalta");
    const abrirNova = () => {
      editandoId = null;
      ["mFunc","mTipo","mMotivo","mDocumento","mRegistadoPor"].forEach(id => document.getElementById(id).value = "");
      document.getElementById("mDias").value = 1;
      document.getElementById("mData").value = new Date().toISOString().split("T")[0];
      actualizarAvisos("");
      document.getElementById("modalFaltaTitulo").textContent = "Registar Falta";
      openModal("modalFalta");
    };
    btnNova?.addEventListener("click", abrirNova);

    document.getElementById("modalFaltaFechar").addEventListener("click",   () => closeModal("modalFalta"));
    document.getElementById("modalFaltaCancelar").addEventListener("click", () => closeModal("modalFalta"));
    bindModalOverlay("modalFalta");

    document.getElementById("btnGuardarFalta").addEventListener("click", async () => {
      const funcId = document.getElementById("mFunc").value;
      const data   = document.getElementById("mData").value;
      const tipo   = document.getElementById("mTipo").value;
      const dias   = +document.getElementById("mDias").value;
      if (!funcId || !data || !tipo || !dias) { toast("Preencha todos os campos obrigatórios.", "err"); return; }

      const d    = new Date(data);
      const btn  = document.getElementById("btnGuardarFalta");
      spinner(btn, true);
      const dados = {
        funcionarioId: funcId, data, tipo, dias,
        ano:          d.getFullYear(),
        mes:          d.getMonth() + 1,
        motivo:       document.getElementById("mMotivo").value.trim(),
        documento:    document.getElementById("mDocumento").value.trim(),
        registadoPor: document.getElementById("mRegistadoPor").value.trim(),
      };
      try {
        if (editandoId) {
          await actualizarFalta(editandoId, dados);
          toast("Falta actualizada.", "ok");
        } else {
          await adicionarFalta(dados);
          toast("Falta registada.", "ok");
        }
        closeModal("modalFalta");
        editandoId = null;
        await pesquisar();
      } catch (e) { console.error(e); toast("Erro ao guardar.", "err"); }
      finally { spinner(btn, false); }
    });

    document.getElementById("btnFiltrar").addEventListener("click", pesquisar);

    // Delegação na tabela
    document.getElementById("tabelaFaltas").addEventListener("click", async e => {
      const editBtn = e.target.closest("[data-edit]");
      const delBtn  = e.target.closest("[data-del]");
      if (editBtn) abrirEditar(editBtn.dataset.edit);
      if (delBtn) {
        if (!confirm("Eliminar este registo?")) return;
        try { await eliminarFalta(delBtn.dataset.del); toast("Falta eliminada.", "ok"); await pesquisar(); }
        catch { toast("Erro ao eliminar.", "err"); }
      }
    });

    await pesquisar();
    return () => {
      funcionarios = []; faltas = []; editandoId = null;
      btnNova?.removeEventListener("click", abrirNova);
    };
  },
};
