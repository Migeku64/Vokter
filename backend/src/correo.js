// correo.js — envío del código de verificación.
// En modo desarrollo NO se envía correo: el código se muestra en la terminal de VS Code.
// Para producción, el backend debe conectar aquí un servicio de correo (SMTP, Amazon SES, Resend…).
import { enmascararCorreo } from './seguridad.js';

export function crearEnvioCodigo(config, log = console) {
  return async function enviarCodigo(destino, codigo) {
    if (config.modo === 'desarrollo') {
      log.log(`[código de verificación] para ${enmascararCorreo(destino)}: ${codigo}  (modo desarrollo: no se envía correo)`);
      return;
    }
    throw new Error('Envío de correo no configurado: conecta un servicio de correo en backend/src/correo.js');
  };
}
