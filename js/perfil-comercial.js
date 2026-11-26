// perfil-comercial.js — tarjeta "Datos comerciales" de Mi cuenta.
// El cliente completa su perfil con su registro REAL de la base comercio, pero solo después de
// demostrar que es el dueño: la API envía un código al correo que tiene ese registro.
// Los datos comerciales se guardan aparte (user_metadata.comercial): no reemplazan nombre, documento ni celular.
import * as A from './auth-core.js';
import * as API from './comercio-api.js';
import { icon } from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const valor = (v) => (v ? esc(v) : '<span class="co-vacio">Sin dato</span>');

export function mountPerfilComercial(box, { user, toast }) {
  let comercial = user.user_metadata?.comercial || null;

  function pintar() {
    if (comercial) {
      const c = comercial;
      box.innerHTML = `
        <div class="pf-card-head">
          <h2 id="pf-co-title">Datos comerciales</h2>
          <span class="pf-count co-ok">${icon('check', 14)} Verificado el ${esc(fecha(c.verificado_at))}</span>
        </div>
        <div class="co-grid">
          <div class="co-dato co-wide"><small>Empresa o titular</small><strong>${valor(c.empresa)}</strong></div>
          <div class="co-dato"><small>NIT</small><strong>${valor(c.nit)}</strong></div>
          <div class="co-dato"><small>Número de cliente</small><strong>${valor(c.clienteId)}</strong></div>
          <div class="co-dato co-wide"><small>Dirección</small><strong>${valor(c.direccion)}</strong></div>
          <div class="co-dato"><small>Teléfono</small><strong>${valor(c.telefono)}</strong></div>
          <div class="co-dato"><small>Correo comercial</small><strong>${valor(c.correo)}</strong></div>
          <div class="co-dato co-wide"><small>Tipo de registro</small><strong>${valor(c.tipoRegistro)}${c.anio ? ` · ${esc(c.anio)}` : ''}</strong></div>
        </div>
        <div class="co-actions">
          <button type="button" class="btn btn-ghost" data-co="abrir">Actualizar datos</button>
          <button type="button" class="pm-act" data-co="quitar">Quitar de mi perfil</button>
        </div>
        <p class="pm-secure">${icon('shield', 15)}<span>Datos tomados de tu registro comercial y confirmados con un código enviado a su correo. Tus datos personales no cambian.</span></p>`;
    } else {
      box.innerHTML = `
        <div class="co-cta">
          <span class="pf-ico">${icon('award', 24)}</span>
          <div>
            <h2 id="pf-co-title">Completa tu perfil comercial</h2>
            <p>Si tu empresa o tu negocio ya está registrado con nosotros, trae sus datos reales a tu perfil: razón social, NIT, dirección y teléfono.</p>
          </div>
          <button type="button" class="btn btn-primary" data-co="abrir">Completar con mis datos comerciales</button>
        </div>`;
    }
  }

  box.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-co]'); if (!b) return;
    if (b.dataset.co === 'abrir') return abrirFlujo();
    if (b.dataset.co === 'quitar') {
      if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = '¿Seguro? Pulsa otra vez'; setTimeout(() => { if (b.isConnected) { b.dataset.confirm = ''; b.textContent = 'Quitar de mi perfil'; } }, 3500); return; }
      try { await A.updateProfile({ comercial: null }); comercial = null; pintar(); toast('Datos comerciales quitados de tu perfil'); }
      catch (err) { toast(err.message, 'error'); }
    }
  });

  function abrirFlujo() {
    const dlg = document.createElement('dialog');
    dlg.className = 'modal co-modal';
    dlg.setAttribute('aria-labelledby', 'co-m-title');
    dlg.innerHTML = `
      <h2 id="co-m-title">Datos comerciales</h2>
      <div class="au co-body">
        <form class="co-paso" data-paso="1" novalidate>
          <p class="modal-sub">Escribe el NIT de tu empresa (con o sin dígito de verificación) o tu número de cliente. Te enviaremos un código al correo que tenemos registrado.</p>
          <div class="au-field" data-field="co-id"><label for="co-id">NIT o número de cliente</label>
            <input type="text" id="co-id" inputmode="numeric" autocomplete="off" maxlength="15" placeholder="Ej. 860404463-1" spellcheck="false">
            <small class="au-error" id="co-id-error"></small></div>
          <div class="modal-actions"><button type="button" class="btn btn-ghost" data-cerrar>Cancelar</button><button type="submit" class="btn btn-primary">Enviar código</button></div>
        </form>
        <form class="co-paso" data-paso="2" novalidate hidden>
          <p class="modal-sub" id="co-msg"></p>
          <div class="au-devcode" id="co-dev" hidden></div>
          <div class="au-field" data-field="co-code"><label for="co-code">Código de verificación</label>
            <input type="text" id="co-code" class="au-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••">
            <small class="au-error" id="co-code-error"></small></div>
          <div class="modal-actions"><button type="button" class="btn btn-ghost" data-volver>Cambiar NIT</button><button type="submit" class="btn btn-primary">Verificar</button></div>
        </form>
        <div class="co-paso" data-paso="3" hidden>
          <p class="modal-sub">Encontramos tu registro. Revisa los datos y guárdalos en tu perfil.</p>
          <div class="co-grid" id="co-preview"></div>
          <div class="modal-actions"><button type="button" class="btn btn-ghost" data-cerrar>Cancelar</button><button type="button" class="btn btn-primary" data-guardar>Guardar en mi perfil</button></div>
        </div>
      </div>`;
    document.body.appendChild(dlg);
    dlg.showModal();
    const $ = (s) => dlg.querySelector(s);
    const paso = (n) => dlg.querySelectorAll('.co-paso').forEach((p) => { p.hidden = p.dataset.paso !== String(n); });
    const err = (id, m) => { $(`#${id}-error`).textContent = m || ''; dlg.querySelector(`[data-field="${id}"]`).classList.toggle('has-error', Boolean(m)); };
    let identificador = ''; let datos = null;

    $('#co-id').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^0-9A-Za-z.\- ]/g, ''); err('co-id', ''); });
    $('#co-code').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); err('co-code', ''); });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-cerrar]')) dlg.close();
      if (e.target.closest('[data-volver]')) { paso(1); $('#co-id').focus(); }
    });
    dlg.addEventListener('close', () => dlg.remove());

    const ocupado = async (btn, fn) => { btn.disabled = true; try { await fn(); } finally { btn.disabled = false; } };

    $('[data-paso="1"]').addEventListener('submit', (e) => {
      e.preventDefault();
      ocupado(e.submitter || $('[data-paso="1"] [type=submit]'), async () => {
        const v = $('#co-id').value.replace(/[.\s-]/g, '');
        if (!/^[0-9A-Za-z]{3,15}$/.test(v)) return err('co-id', 'Escribe el NIT o número de cliente: solo números (y letras si aplica), entre 3 y 15.');
        try {
          const r = await API.solicitarCodigo(v);
          identificador = v;
          $('#co-msg').textContent = r.mensaje;
          const dev = $('#co-dev');
          if (r.desarrollo?.codigo) { dev.innerHTML = `<strong>Modo desarrollo</strong> · Código enviado a ${esc(r.desarrollo.correo)}: <b class="au-devnum">${esc(r.desarrollo.codigo)}</b><small>En producción este código llega solo al correo registrado.</small>`; dev.hidden = false; }
          else if (r.desarrollo?.aviso) { dev.innerHTML = `<strong>Modo desarrollo</strong> · ${esc(r.desarrollo.aviso)}`; dev.hidden = false; }
          else dev.hidden = true;
          $('#co-code').value = '';
          paso(2); $('#co-code').focus();
        } catch (x) { err('co-id', x.message); }
      });
    });

    $('[data-paso="2"]').addEventListener('submit', (e) => {
      e.preventDefault();
      ocupado(e.submitter || $('[data-paso="2"] [type=submit]'), async () => {
        const c = $('#co-code').value;
        if (!/^\d{6}$/.test(c)) return err('co-code', 'El código tiene 6 números.');
        try {
          datos = (await API.verificarCodigo(identificador, c)).datos;
          $('#co-preview').innerHTML = [
            ['Empresa o titular', datos.empresa, true], ['NIT', datos.nit], ['Número de cliente', datos.clienteId],
            ['Dirección', datos.direccion, true], ['Teléfono', datos.telefono], ['Correo comercial', datos.correo]
          ].map(([l, v, w]) => `<div class="co-dato${w ? ' co-wide' : ''}"><small>${l}</small><strong>${valor(v)}</strong></div>`).join('');
          paso(3);
        } catch (x) { err('co-code', x.message); }
      });
    });

    $('[data-guardar]').addEventListener('click', (e) => ocupado(e.currentTarget, async () => {
      try {
        comercial = { ...datos, verificado_at: new Date().toISOString() };
        await A.updateProfile({ comercial });
        dlg.close(); pintar(); toast('Datos comerciales guardados en tu perfil');
      } catch (x) { toast(x.message, 'error'); }
    }));
    $('#co-id').focus();
  }

  pintar();
}
