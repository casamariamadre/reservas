/**
 * Casa María Madre – Puente entre la app y Google (Sheets + Calendar)
 * ---------------------------------------------------------------
 * 1. Cambia CLAVE_ACCESO por una clave propia (la que usaréis en la app).
 * 2. Ejecuta una vez la función  configurar  (menú ▶ Ejecutar) y acepta los permisos.
 * 3. Implementar ▸ Nueva implementación ▸ Aplicación web
 *      Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier usuario
 * 4. Copia la URL que termina en /exec y pégala en config.js de la app.
 */

// ====== AJUSTES (puedes cambiarlos) ======
var CLAVE_ACCESO = 'CAMBIA-ESTA-CLAVE';
var NOMBRE_CALENDARIO = 'Casa María Madre – Ocupación';
var ZONA = 'Europe/Madrid';
var HORA_ENTRADA = '12:00';
var HORA_SALIDA = '16:00';
var VERSION = '1.1.0';

// Aviso de reservas provisionales (un mes antes, el lunes de esa semana)
var AVISO_PARA = 'casamariamadre@siguenza-guadalajara.org';
var AVISO_ATENCION = 'Viviana';
var APP_URL = 'https://madremaria780.github.io/reservas/';
var TIPOS = ['Alojamiento', 'Día / sala', 'Bloqueo'];

// ====== Estructura de datos ======
var HOJAS = {
  Habitaciones: ['Nº', 'Tipo', 'Camas', 'Capacidad', 'Estado', 'Ubicación'],
  Reservas: ['ID', 'Grupo', 'Responsable', 'Teléfono', 'Email', 'Entrada', 'Hora entrada',
             'Salida', 'Hora salida', 'Personas', 'Estado', 'Observaciones', 'Evento calendario',
             'Creado por', 'Creado el', 'Modificado por', 'Modificado el', 'Tipo', 'Aviso enviado'],
  Asignaciones: ['ID reserva', 'Habitación', 'Personas'],
  Registro: ['Fecha', 'Gestor', 'Acción', 'ID reserva', 'Detalle']
};

var HABITACIONES_INICIALES = [
  // Nº, Tipo, Camas, Capacidad, Estado, Ubicación
  [1, 'Triple', '3 camas', 3, 'Cerrada', 'Fila inferior'],
  [2, 'Triple', '3 camas', 3, 'Disponible', 'Fila inferior'],
  [3, 'Triple', '3 camas', 3, 'Disponible', 'Fila inferior'],
  [4, 'Doble', '2 camas', 2, 'Disponible', 'Fila inferior'],
  [5, 'Doble', '2 camas', 2, 'Disponible', 'Fila inferior'],
  [6, 'Doble', '2 camas', 2, 'Disponible', 'Fila inferior'],
  [7, 'Doble', '2 camas', 2, 'Disponible', 'Fila inferior'],
  [8, 'Doble', '2 camas', 2, 'Disponible', 'Fila inferior'],
  [9, 'Doble', '2 camas', 2, 'Disponible', 'Fila inferior'],
  [10, 'Doble', '2 camas', 2, 'Disponible', 'Fila inferior'],
  [11, 'Doble', '2 camas', 2, 'Disponible', 'Fila superior'],
  [12, 'Doble', '2 camas', 2, 'Disponible', 'Fila superior'],
  [13, 'Doble', '2 camas', 2, 'Disponible', 'Fila superior'],
  [14, 'Doble', '2 camas', 2, 'Disponible', 'Fila superior'],
  [15, 'Doble', '2 camas', 2, 'Disponible', 'Fila superior'],
  [16, 'Triple', '3 camas', 3, 'Disponible', 'Fila superior'],
  [17, 'Triple', '3 camas', 3, 'Disponible', 'Fila superior'],
  [18, 'Triple', '3 camas', 3, 'Disponible', 'Fila superior'],
  [19, 'Quíntuple', '2 literas + 1 cama', 5, 'Disponible', 'Fila superior'],
  [20, 'Triple', '3 camas', 3, 'Disponible', 'Fila superior'],
  [21, 'Triple', '3 camas', 3, 'Disponible', 'Fila superior'],
  [22, 'Triple', '3 camas', 3, 'Disponible', 'Fila superior'],
  [23, 'Cuádruple', '2 literas', 4, 'Disponible', 'Fila inferior'],
  [24, 'Cuádruple', '2 literas', 4, 'Disponible', 'Fila inferior'],
  [25, 'Triple', '3 camas', 3, 'Disponible', 'Fila inferior']
];

// =====================================================================
// CONFIGURACIÓN INICIAL (ejecutar una vez desde el editor)
// =====================================================================
function configurar() {
  var ss = libro_();
  Object.keys(HOJAS).forEach(function (nombre) {
    var sh = ss.getSheetByName(nombre);
    if (!sh) sh = ss.insertSheet(nombre);
    var cab = HOJAS[nombre];
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold');
      sh.setFrozenRows(1);
    } else {
      asegurarCabeceras_(nombre);
    }
    // Todo como texto: evita que Sheets convierta fechas, horas o teléfonos.
    if (nombre !== 'Habitaciones') sh.getRange(1, 1, 1000, cab.length).setNumberFormat('@');
  });
  var hab = ss.getSheetByName('Habitaciones');
  if (hab.getLastRow() < 2) {
    hab.getRange(2, 1, HABITACIONES_INICIALES.length, HABITACIONES_INICIALES[0].length)
       .setValues(HABITACIONES_INICIALES);
  }
  var hoja1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hoja1 && ss.getSheets().length > 1 && hoja1.getLastRow() === 0) ss.deleteSheet(hoja1);
  var cal = calendario_();
  Logger.log('Listo. Calendario: ' + cal.getName() + ' (' + cal.getId() + ')');
  return { calendario: cal.getId() };
}

// =====================================================================
// ENTRADA DE LA APP
// =====================================================================
function doGet() {
  return json_({ ok: true, datos: { app: 'Casa María Madre', version: VERSION } });
}

function doPost(e) {
  var pet;
  try {
    pet = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Petición no válida.' });
  }
  return json_(atender(pet));
}

/** Lógica común (también la usa el modo demostración de la app). */
function atender(pet) {
  try {
    if (!CLAVE_ACCESO || /^CAMBIA/.test(CLAVE_ACCESO)) throw new Error('Falta configurar la clave en el script.');
    if (!pet || pet.clave !== CLAVE_ACCESO) return { ok: false, error: 'Clave incorrecta.', codigo: 'CLAVE' };
    var gestor = String(pet.gestor || 'Gestor').slice(0, 40);
    var d = pet.datos || {};
    switch (pet.accion) {
      case 'ping': return { ok: true, datos: { version: VERSION } };
      case 'inicial': return { ok: true, datos: estado_() };
      case 'guardarReserva': return conBloqueo_(function () { return guardarReserva_(d, gestor); });
      case 'cancelarReserva': return conBloqueo_(function () { return cancelarReserva_(d.id, gestor); });
      case 'borrarReserva': return conBloqueo_(function () { return borrarReserva_(d.id, gestor); });
      case 'probarAviso': return { ok: true, datos: probarAviso_(gestor) };
      case 'regenerarCalendario': return conBloqueo_(function () { return regenerarCalendario_(gestor); });
      case 'importarCalendario': return conBloqueo_(function () { return importarCalendario_(gestor); });
      default: return { ok: false, error: 'Acción desconocida.' };
    }
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

function conBloqueo_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'Otro gestor está guardando. Inténtalo de nuevo.' };
  try {
    asegurarCabeceras_('Reservas');
    var r = fn();
    r.datos = r.datos || {};
    r.datos.estado = estado_();
    return r;
  } finally {
    lock.releaseLock();
  }
}

// =====================================================================
// LECTURA
// =====================================================================
function estado_() {
  var habitaciones = filas_('Habitaciones').map(function (h) {
    return { numero: Number(h['Nº']), tipo: h['Tipo'], camas: h['Camas'], capacidad: Number(h['Capacidad']),
             estado: h['Estado'], ubicacion: h['Ubicación'] };
  }).filter(function (h) { return h.numero; });
  var asig = {};
  filas_('Asignaciones').forEach(function (a) {
    var id = String(a['ID reserva']);
    (asig[id] = asig[id] || []).push({ habitacion: Number(a['Habitación']), personas: Number(a['Personas']) });
  });
  var reservas = filas_('Reservas').filter(function (r) { return r['ID']; }).map(function (r) {
    var o = reservaDeFila_(r);
    o.asignaciones = asig[o.id] || [];
    return o;
  });
  return { habitaciones: habitaciones, reservas: reservas,
           ajustes: { horaEntrada: HORA_ENTRADA, horaSalida: HORA_SALIDA, avisoPara: AVISO_PARA, avisoAtencion: AVISO_ATENCION, version: VERSION } };
}

function reservaDeFila_(r) {
  return {
    id: String(r['ID']), grupo: r['Grupo'], responsable: r['Responsable'], telefono: String(r['Teléfono'] || ''),
    email: r['Email'], entrada: fecha_(r['Entrada']), horaEntrada: hora_(r['Hora entrada']) || HORA_ENTRADA,
    salida: fecha_(r['Salida']), horaSalida: hora_(r['Hora salida']) || HORA_SALIDA,
    personas: Number(r['Personas']) || 0, estado: r['Estado'] || 'Confirmada', observaciones: r['Observaciones'],
    eventoId: r['Evento calendario'], creadoPor: r['Creado por'], creadoEl: r['Creado el'],
    modificadoPor: r['Modificado por'], modificadoEl: r['Modificado el'],
    tipo: TIPOS.indexOf(r['Tipo']) >= 0 ? r['Tipo'] : 'Alojamiento', avisoEnviado: r['Aviso enviado'] || ''
  };
}

// =====================================================================
// ESCRITURA
// =====================================================================
function guardarReserva_(d, gestor) {
  var r = d.reserva || {};
  var res = {
    id: r.id ? String(r.id) : nuevoId_(),
    grupo: texto_(r.grupo, 80), responsable: texto_(r.responsable, 80), telefono: texto_(r.telefono, 30),
    email: texto_(r.email, 80), entrada: r.entrada, horaEntrada: r.horaEntrada || HORA_ENTRADA,
    salida: r.salida, horaSalida: r.horaSalida || HORA_SALIDA,
    estado: ['Confirmada', 'Provisional'].indexOf(r.estado) >= 0 ? r.estado : 'Provisional',
    observaciones: texto_(r.observaciones, 500),
    tipo: TIPOS.indexOf(r.tipo) >= 0 ? r.tipo : 'Alojamiento'
  };
  res.telefono = formatoTelefono_(res.telefono);
  if (res.tipo === 'Bloqueo' && !res.grupo) res.grupo = 'DESCANSO';
  if (!res.grupo) throw new Error('Indica el nombre del grupo.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(res.entrada || '') || !/^\d{4}-\d{2}-\d{2}$/.test(res.salida || ''))
    throw new Error('Fechas de entrada y salida obligatorias.');
  if (!/^\d{2}:\d{2}$/.test(res.horaEntrada) || !/^\d{2}:\d{2}$/.test(res.horaSalida))
    throw new Error('Hora no válida (usa HH:MM).');
  var ini = momento_(res.entrada, res.horaEntrada), fin = momento_(res.salida, res.horaSalida);
  if (fin <= ini) throw new Error('La salida debe ser posterior a la entrada.');

  // Solapamientos: se permiten; solo se bloquea si coinciden habitaciones.
  var existentes = estado_().reservas;
  var previa = null, solapes = [];
  existentes.forEach(function (x) {
    if (x.id === res.id) { previa = x; return; }
    if (x.estado === 'Cancelada') return;
    var xi = momento_(x.entrada, x.horaEntrada), xf = momento_(x.salida, x.horaSalida);
    if (ini < xf && fin > xi) solapes.push(x);
  });
  if (r.id && !previa) throw new Error('La reserva ya no existe. Recarga los datos.');
  if (previa && previa.estado === 'Cancelada') throw new Error('Esa reserva está cancelada.');

  // Asignaciones por habitación
  var habs = {};
  estado_().habitaciones.forEach(function (h) { habs[h.numero] = h; });
  var asignaciones = [], total = 0, vistas = {};
  if (res.tipo !== 'Alojamiento') d.asignaciones = [];
  (d.asignaciones || []).forEach(function (a) {
    var n = Number(a.habitacion), p = Math.floor(Number(a.personas) || 0);
    if (!p) return;
    var h = habs[n];
    if (!h) throw new Error('La habitación ' + n + ' no existe.');
    if (h.estado !== 'Disponible') throw new Error('La habitación ' + n + ' está cerrada.');
    if (p < 0 || p > h.capacidad) throw new Error('La habitación ' + n + ' admite como máximo ' + h.capacidad + ' personas.');
    if (vistas[n]) throw new Error('Habitación ' + n + ' repetida.');
    vistas[n] = true;
    solapes.forEach(function (x) {
      (x.asignaciones || []).forEach(function (ax) {
        if (ax.habitacion === n) throw new Error('La habitación ' + n + ' ya está asignada a «' + x.grupo + '» (' +
          legible_(x.entrada) + ' → ' + legible_(x.salida) + ').');
      });
    });
    asignaciones.push({ habitacion: n, personas: p });
    total += p;
  });
  var manual = Math.max(0, Math.floor(Number(r.personas) || 0));
  res.personas = res.tipo === 'Bloqueo' ? 0 : Math.max(total, manual);
  res.avisoEnviado = previa && previa.entrada === res.entrada ? (previa.avisoEnviado || '') : '';

  var ahora = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm');
  res.creadoPor = previa ? previa.creadoPor : gestor;
  res.creadoEl = previa ? previa.creadoEl : ahora;
  res.modificadoPor = gestor;
  res.modificadoEl = ahora;
  res.eventoId = previa ? previa.eventoId : '';
  res.eventoId = sincronizarEvento_(res);

  escribirReserva_(res);
  borrarAsignaciones_(res.id);
  var sh = libro_().getSheetByName('Asignaciones');
  asignaciones.forEach(function (a) { sh.appendRow([res.id, String(a.habitacion), String(a.personas)]); });
  registrar_(gestor, previa ? 'Modificar' : 'Crear', res.id, res.tipo + ' · ' + res.grupo + ' · ' + res.entrada + '→' + res.salida + ' · ' + res.personas + ' pers.');
  return { ok: true, datos: { id: res.id, solapes: solapes.map(function (x) { return x.grupo; }) } };
}

function cancelarReserva_(id, gestor) {
  var fila = buscarFila_('Reservas', 'ID', String(id));
  if (!fila) throw new Error('La reserva no existe.');
  var res = leerReserva_(fila);
  borrarEvento_(res.eventoId);
  res.estado = 'Cancelada';
  res.eventoId = '';
  res.modificadoPor = gestor;
  res.modificadoEl = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm');
  escribirReserva_(res);
  registrar_(gestor, 'Cancelar', res.id, res.grupo);
  return { ok: true, datos: { id: res.id } };
}

function borrarReserva_(id, gestor) {
  var fila = buscarFila_('Reservas', 'ID', String(id));
  if (!fila) throw new Error('La reserva no existe.');
  var res = leerReserva_(fila);
  borrarEvento_(res.eventoId);
  borrarAsignaciones_(res.id);
  libro_().getSheetByName('Reservas').deleteRow(fila);
  registrar_(gestor, 'Borrar', res.id, res.grupo + ' · ' + res.entrada + '→' + res.salida + ' (' + res.estado + ')');
  return { ok: true, datos: { id: res.id } };
}

function leerReserva_(fila) {
  var sh = libro_().getSheetByName('Reservas');
  var cab = sh.getRange(1, 1, 1, HOJAS.Reservas.length).getValues()[0];
  var vals = sh.getRange(fila, 1, 1, cab.length).getValues()[0];
  return reservaDeFila_(objeto_(cab, vals));
}

function escribirReserva_(r) {
  var fila = [r.id, r.grupo, r.responsable, r.telefono, r.email, r.entrada, r.horaEntrada, r.salida, r.horaSalida,
              String(r.personas || 0), r.estado, r.observaciones, r.eventoId, r.creadoPor, r.creadoEl,
              r.modificadoPor, r.modificadoEl, r.tipo || 'Alojamiento', r.avisoEnviado || '']
              .map(function (v) { return v == null ? '' : String(v); });
  var sh = libro_().getSheetByName('Reservas');
  var n = buscarFila_('Reservas', 'ID', r.id);
  if (n) sh.getRange(n, 1, 1, fila.length).setValues([fila]);
  else sh.appendRow(fila);
}

function borrarAsignaciones_(id) {
  var sh = libro_().getSheetByName('Asignaciones');
  var v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) if (String(v[i][0]) === id) sh.deleteRow(i + 1);
}

// =====================================================================
// CALENDARIO
// =====================================================================
function calendario_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('CALENDARIO_ID');
  var cal = id ? CalendarApp.getCalendarById(id) : null;
  if (!cal) {
    var lista = CalendarApp.getCalendarsByName(NOMBRE_CALENDARIO);
    cal = lista.length ? lista[0] : CalendarApp.createCalendar(NOMBRE_CALENDARIO, { timeZone: ZONA });
    props.setProperty('CALENDARIO_ID', cal.getId());
  }
  return cal;
}

function tituloEvento_(r) {
  if (r.tipo === 'Bloqueo') return 'BLOQUEO · ' + r.grupo;
  var t = (r.estado === 'Provisional' ? '[PROVISIONAL] ' : '') + r.grupo;
  if (r.personas) t += ' – ' + r.personas + ' personas';
  if (r.tipo === 'Día / sala') t += ' (sin alojamiento)';
  return t;
}

function descripcionEvento_(r) {
  var l = [
    'Responsable: ' + (r.responsable || '—'),
    'Teléfono: ' + (r.telefono || '—'),
    'Entrada: ' + legible_(r.entrada) + ' ' + r.horaEntrada,
    'Salida: ' + legible_(r.salida) + ' ' + r.horaSalida,
    'Personas: ' + r.personas,
    'Tipo: ' + (r.tipo || 'Alojamiento')
  ];
  if (r.observaciones) l.push('Observaciones: ' + r.observaciones);
  l.push('', 'Gestionado desde la app Casa María Madre. No editar aquí.', 'ID reserva: ' + r.id);
  return l.join('\n');
}

function sincronizarEvento_(r) {
  var cal = calendario_();
  var ini = momento_(r.entrada, r.horaEntrada), fin = momento_(r.salida, r.horaSalida);
  var ev = r.eventoId ? cal.getEventById(r.eventoId) : null;
  if (ev) {
    ev.setTitle(tituloEvento_(r));
    ev.setTime(ini, fin);
    ev.setDescription(descripcionEvento_(r));
  } else {
    ev = cal.createEvent(tituloEvento_(r), ini, fin, { description: descripcionEvento_(r) });
  }
  ev.setTag('reservaId', r.id);
  ev.setColor(r.tipo === 'Bloqueo' ? CalendarApp.EventColor.GRAY :
              r.estado === 'Provisional' ? CalendarApp.EventColor.YELLOW :
              r.tipo === 'Día / sala' ? CalendarApp.EventColor.CYAN : CalendarApp.EventColor.GREEN);
  return ev.getId();
}

function borrarEvento_(eventoId) {
  if (!eventoId) return;
  var ev = calendario_().getEventById(eventoId);
  if (ev) ev.deleteEvent();
}

/** Borra todos los eventos de la app y los vuelve a crear desde la hoja. */
function regenerarCalendario_(gestor) {
  var cal = calendario_();
  var desde = new Date(2000, 0, 1), hasta = new Date(2100, 0, 1);
  cal.getEvents(desde, hasta).forEach(function (ev) { if (ev.getTag('reservaId')) ev.deleteEvent(); });
  var n = 0;
  estado_().reservas.forEach(function (r) {
    if (r.estado === 'Cancelada') return;
    r.eventoId = '';
    r.eventoId = sincronizarEvento_(r);
    escribirReserva_(r);
    n++;
  });
  registrar_(gestor, 'Regenerar calendario', '', n + ' eventos');
  return { ok: true, datos: { eventos: n } };
}

/** Crea reservas a partir de eventos añadidos a mano en el calendario (fase 1). */
function importarCalendario_(gestor) {
  var cal = calendario_();
  var hoy = new Date();
  var desde = new Date(hoy.getFullYear() - 1, 0, 1), hasta = new Date(hoy.getFullYear() + 3, 0, 1);
  var creadas = 0, omitidas = [];
  var existentes = estado_().reservas.filter(function (x) { return x.estado !== 'Cancelada'; });
  cal.getEvents(desde, hasta).forEach(function (ev) {
    if (ev.getTag('reservaId')) return;
    var t = ev.getTitle();
    var provisional = /^\s*\[?provisional\]?\s*/i.test(t);
    var limpio = t.replace(/^\s*\[?provisional\]?\s*/i, '');
    var m = limpio.match(/^(.*?)\s*[–-]\s*(\d+)\s*personas?/i);
    var ini = ev.getStartTime(), fin = ev.getEndTime();
    var r = {
      id: nuevoId_(), grupo: texto_(m ? m[1] : limpio, 80), responsable: '', telefono: '', email: '',
      entrada: Utilities.formatDate(ini, ZONA, 'yyyy-MM-dd'),
      horaEntrada: ev.isAllDayEvent() ? HORA_ENTRADA : Utilities.formatDate(ini, ZONA, 'HH:mm'),
      salida: Utilities.formatDate(ev.isAllDayEvent() ? new Date(fin.getTime() - 86400000) : fin, ZONA, 'yyyy-MM-dd'),
      horaSalida: ev.isAllDayEvent() ? HORA_SALIDA : Utilities.formatDate(fin, ZONA, 'HH:mm'),
      personas: m ? Number(m[2]) : 0, estado: provisional ? 'Provisional' : 'Confirmada', observaciones: ''
    };
    var desc = ev.getDescription() || '';
    var mr = desc.match(/Responsable:\s*(.+)/i); if (mr) r.responsable = texto_(mr[1], 80);
    var mt = desc.match(/Tel[eé]fono:\s*(.+)/i); if (mt) r.telefono = texto_(mt[1], 30);
    var mo = desc.match(/Observaciones:\s*(.+)/i); if (mo) r.observaciones = texto_(mo[1], 500);
    var ri = momento_(r.entrada, r.horaEntrada), rf = momento_(r.salida, r.horaSalida);
    if (rf <= ri) { omitidas.push(t + ' (fechas no válidas)'); return; }
    r.tipo = m && Number(m[2]) ? 'Alojamiento' : (/bloqueo|descanso/i.test(limpio) ? 'Bloqueo' : 'Alojamiento');
    r.creadoPor = r.modificadoPor = gestor;
    r.creadoEl = r.modificadoEl = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm');
    r.eventoId = ev.getId();          // se reutiliza el evento: pasa a ser de la app
    if (ev.isAllDayEvent()) { ev.deleteEvent(); r.eventoId = ''; }  // los de día completo se recrean con horas
    r.eventoId = sincronizarEvento_(r);
    escribirReserva_(r);
    existentes.push(r);
    creadas++;
  });
  registrar_(gestor, 'Importar calendario', '', creadas + ' importadas, ' + omitidas.length + ' omitidas');
  return { ok: true, datos: { importadas: creadas, omitidas: omitidas } };
}

// =====================================================================
// AVISOS POR CORREO (reservas provisionales)
// =====================================================================
/** Ejecutar UNA vez desde el editor: programa la revisión todos los lunes a las 8:00. */
function instalarAvisos() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'revisarAvisos') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('revisarAvisos').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  Logger.log('Avisos programados: todos los lunes hacia las 8:00.');
}

/** Lunes de la semana en que falta un mes para la entrada (texto yyyy-MM-dd). */
function fechaAviso_(entrada) {
  var p = String(entrada).split('-');
  var y = +p[0], m = +p[1] - 1, d = +p[2];
  m -= 1; if (m < 0) { m = 11; y -= 1; }
  var ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  var f = new Date(Date.UTC(y, m, Math.min(d, ultimo)));
  f.setUTCDate(f.getUTCDate() - ((f.getUTCDay() + 6) % 7));
  return f.toISOString().slice(0, 10);
}

/** La ejecuta el programador cada lunes. Envía los avisos pendientes. */
function revisarAvisos(forzar) {
  var hoy = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd');
  var esLunes = Utilities.formatDate(new Date(), ZONA, 'u') === '1';
  if (!esLunes && forzar !== true) return 0;
  var enviados = 0;
  estado_().reservas.forEach(function (r) {
    if (r.estado !== 'Provisional' || r.tipo === 'Bloqueo' || r.avisoEnviado) return;
    if (hoy < fechaAviso_(r.entrada) || hoy >= r.entrada) return;
    enviarAviso_(r, false);
    r.avisoEnviado = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm');
    escribirReserva_(r);
    registrar_('App', 'Aviso provisional', r.id, r.grupo + ' → ' + AVISO_PARA);
    enviados++;
  });
  return enviados;
}

function enviarAviso_(r, prueba) {
  var asunto = (prueba ? '[PRUEBA] ' : '') + 'Reserva provisional pendiente: ' + r.grupo + ' (' +
               legible_(r.entrada) + ' → ' + legible_(r.salida) + ')';
  var fila = function (k, v) {
    return '<tr><td style="padding:3px 12px 3px 0;color:#777;">' + k + '</td><td style="padding:3px 0;"><b>' + v + '</b></td></tr>';
  };
  var tel = r.telefono || '<span style="color:#B42318">sin teléfono</span>';
  var mail = r.email ? '<a href="mailto:' + r.email + '" style="color:#89588B;">' + r.email + '</a>' :
                       '<span style="color:#B7791F">sin email</span>';
  var html =
    '<div style="font-family:Verdana,Arial,sans-serif;font-size:13px;color:#333;">' +
    '<p>A la atención de <b>' + AVISO_ATENCION + '</b>:</p>' +
    '<p>Falta aproximadamente <b>un mes</b> para esta reserva y sigue como <b>PROVISIONAL</b>. ' +
    'Conviene contactar con el grupo para confirmarla o liberarla.</p>' +
    '<table style="border-collapse:collapse;font-size:13px;">' +
    fila('Grupo', r.grupo) + fila('Entrada', legible_(r.entrada) + ' · ' + r.horaEntrada) +
    fila('Salida', legible_(r.salida) + ' · ' + r.horaSalida) + fila('Personas', r.personas || '—') +
    fila('Responsable', r.responsable || '—') + fila('Teléfono', tel) + fila('Email', mail) +
    (r.observaciones ? fila('Observaciones', r.observaciones) : '') + '</table>' +
    '<p style="margin-top:16px;"><a href="' + APP_URL + '#/reserva/' + encodeURIComponent(r.id) + '" ' +
    'style="background:#85200C;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none;">Abrir la reserva en la app</a></p>' +
    firmaApp_() + '</div>';
  var texto = 'A la atención de ' + AVISO_ATENCION + ':\n\nReserva PROVISIONAL a un mes vista.\n' +
    'Grupo: ' + r.grupo + '\nEntrada: ' + legible_(r.entrada) + ' ' + r.horaEntrada + '\nSalida: ' + legible_(r.salida) + ' ' + r.horaSalida +
    '\nPersonas: ' + (r.personas || '—') + '\nResponsable: ' + (r.responsable || '—') +
    '\nTeléfono: ' + (r.telefono || 'sin teléfono') + '\nEmail: ' + (r.email || 'sin email') +
    '\n\n— Mensaje automático de la App de Reservas · Casa de Espiritualidad María Madre · Ref. CMM-APP';
  MailApp.sendEmail({ to: AVISO_PARA, subject: asunto, htmlBody: html, body: texto,
                      name: 'App Reservas · Casa María Madre' });
}

function firmaApp_() {
  return '<table style="margin-top:22px;border-collapse:collapse;"><tr>' +
    '<td style="width:4px;background:#89588B;"></td>' +
    '<td style="padding:2px 0 2px 10px;font-family:Verdana,Arial,sans-serif;font-size:11px;color:#555;">' +
    '<span style="font-family:Georgia,serif;font-size:14px;font-weight:bold;color:#85200C;">App de Reservas</span>' +
    '&nbsp;·&nbsp;Casa de Espiritualidad María Madre<br>' +
    '<span style="color:#89588B;">Mensaje automático: no lo ha escrito ninguna persona.</span><br>' +
    '<span style="color:#89588B;font-size:10px;">Ref. CMM-APP</span></td></tr></table>';
}

/** Envía un aviso de prueba al correo de la casa (botón en Ajustes). */
function probarAviso_(gestor) {
  var r = estado_().reservas.filter(function (x) { return x.estado === 'Provisional'; })[0] || {
    id: 'PRUEBA', grupo: 'Grupo de ejemplo', entrada: Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd'),
    salida: Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd'), horaEntrada: HORA_ENTRADA, horaSalida: HORA_SALIDA,
    personas: 0, responsable: 'Responsable de ejemplo', telefono: '600 000 000', email: '' };
  enviarAviso_(r, true);
  registrar_(gestor, 'Aviso de prueba', r.id, AVISO_PARA);
  var activos = false;
  try { activos = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'revisarAvisos'; }); } catch (e) {}
  return { para: AVISO_PARA, avisosProgramados: activos };
}

// =====================================================================
// UTILIDADES
// =====================================================================
function asegurarCabeceras_(nombre) {
  var sh = libro_().getSheetByName(nombre);
  var cab = HOJAS[nombre];
  var actual = sh.getRange(1, 1, 1, cab.length).getValues()[0];
  for (var i = 0; i < cab.length; i++) {
    if (actual[i] !== cab[i]) {
      if (actual[i] === '' || actual[i] == null) {
        sh.getRange(1, i + 1).setValue(cab[i]).setFontWeight('bold');
        sh.getRange(2, i + 1, 999, 1).setNumberFormat('@');
      }
    }
  }
}

/** 612491985 → 612 491 985 ; +34612491985 → +34 612 491 985 ; otros, tal cual. */
function formatoTelefono_(t) {
  var s = String(t || '').trim();
  if (!s) return '';
  var pref = '', dig = s.replace(/[^\d+]/g, '');
  var m = dig.match(/^(\+\d{2}|0034)(\d{9})$/);
  if (m) { pref = (m[1] === '0034' ? '+34' : m[1]) + ' '; dig = m[2]; }
  if (/^\d{9}$/.test(dig)) return pref + dig.slice(0, 3) + ' ' + dig.slice(3, 6) + ' ' + dig.slice(6);
  return s;
}

function libro_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function filas_(nombre) {
  var sh = libro_().getSheetByName(nombre);
  if (!sh) throw new Error('Falta la hoja «' + nombre + '». Ejecuta configurar().');
  var v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  var cab = v[0];
  return v.slice(1).map(function (f) { return objeto_(cab, f); });
}

function objeto_(cab, fila) {
  var o = {};
  cab.forEach(function (c, i) { o[c] = fila[i]; });
  return o;
}

function buscarFila_(hoja, columna, valor) {
  var v = libro_().getSheetByName(hoja).getDataRange().getValues();
  var c = v[0].indexOf(columna);
  for (var i = 1; i < v.length; i++) if (String(v[i][c]) === String(valor)) return i + 1;
  return 0;
}

function registrar_(gestor, accion, id, detalle) {
  libro_().getSheetByName('Registro').appendRow([
    Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm:ss'), gestor, accion, id || '', detalle || '']);
}

function nuevoId_() {
  return 'R' + Utilities.formatDate(new Date(), ZONA, 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
}

function texto_(v, max) { return v == null ? '' : String(v).trim().slice(0, max); }

function momento_(fecha, hora) {
  return Utilities.parseDate(fecha + ' ' + hora, ZONA, 'yyyy-MM-dd HH:mm');
}

function fecha_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, ZONA, 'yyyy-MM-dd');
  return String(v || '');
}

function hora_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, ZONA, 'HH:mm');
  var s = String(v || '');
  return /^\d:\d{2}$/.test(s) ? '0' + s : s;
}

function legible_(f) {
  var p = String(f).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : f;
}
