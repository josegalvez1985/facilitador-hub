// "Mi postulación": el facilitador se postula para el año lectivo (tabla POSTULANTES_FACILITADORES).
// Endpoints mi-postulacion/* (sql/postulacion_app_ethos.sql → PKG_POSTULACION_APP_ETHOS), con el
// ID_FACILITADOR sacado del token en el servidor: la app nunca lo manda.
// Reglas (23/11/2026): el año es el lectivo actual; una postulación por año, que se puede corregir;
// "No de acuerdo" no envía nada; país 1 (Paraguay). Los códigos son los de los CHECK de la tabla
// (ojo: cada nivel de estudio usa los suyos, p. ej. CONCLUIDA en licenciatura).
// Lo cargado y no enviado queda solo en memoria (incluye datos bancarios: nunca en el dispositivo).

import * as Location from 'expo-location';

import { authFetch, ErrorApi } from './auth/api';
import { hoy } from './fechas';
import { ErrorDeCampo } from './intervenciones';

/* ------------------------------------------------------------------------- */
/* Datos del formulario                                                      */
/* ------------------------------------------------------------------------- */

export type Datos = {
  acepta_proceso: string;
  // Personales
  nombre_completo: string;
  cedula: string;
  /** YYYY-MM-DD o '' */
  fecha_nacimiento: string;
  nacionalidad: string;
  telefono: string;
  correo_electronico: string;
  estado_civil: string;
  estado_civil_otro: string;
  vive_con: string;
  hijos: string;
  talle_remera: string;
  // Domicilio
  id_departamento: number | null;
  id_ciudad: number | null;
  direccion: string;
  ubicacion_domicilio: string;
  // Estudios
  secundario_estado: string;
  secundario_titulo: string;
  tecnico_estado: string;
  tecnico_titulo: string;
  tecnico_anio: string;
  licenciatura_estado: string;
  licenciatura_titulo: string;
  licenciatura_anio: string;
  posgrado_estado: string;
  posgrado_titulo: string;
  posgrado_anio: string;
  // Trabajo y recursos
  actividad_laboral: string;
  empresa: string;
  cargo: string;
  movilidad_propia: string;
  tipo_vehiculo: string;
  computadora_propia: string;
  internet_estable: string;
  manejo_office: string;
  // Disponibilidad
  dias_disponibles: string[];
  turno: string;
  // Iglesia
  iglesia_denominacion: string;
  iglesia_nombre: string;
  pastor_nombre: string;
  pastor_telefono: string;
  lider_nombre: string;
  lider_telefono: string;
  bautizado_agua: string;
  areas_ministerio: string;
  // Cobro
  banco_nombre: string;
  banco_sucursal: string;
  titular_nombre: string;
  titular_ci: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  factura_tipo: string;
  factura_emisor: string;
  ruc: string;
};

export type Campo = keyof Datos;
/** Los campos de texto (todos menos los ids y los días). */
export type CampoTexto = Exclude<Campo, 'id_departamento' | 'id_ciudad' | 'dias_disponibles'>;
export type Errores = Partial<Record<Campo | 'general', string>>;

export const PAIS_POR_DEFECTO = 1;
export const LARGO_AREAS = 4000;
export const EDAD_MINIMA = 16;
export const EDAD_MAXIMA = 99;

export function datosVacios(): Datos {
  return {
    acepta_proceso: '',
    nombre_completo: '',
    cedula: '',
    fecha_nacimiento: '',
    nacionalidad: 'Paraguaya',
    telefono: '',
    correo_electronico: '',
    estado_civil: '',
    estado_civil_otro: '',
    vive_con: '',
    hijos: '',
    talle_remera: '',
    id_departamento: null,
    id_ciudad: null,
    direccion: '',
    ubicacion_domicilio: '',
    secundario_estado: '',
    secundario_titulo: '',
    tecnico_estado: '',
    tecnico_titulo: '',
    tecnico_anio: '',
    licenciatura_estado: '',
    licenciatura_titulo: '',
    licenciatura_anio: '',
    posgrado_estado: '',
    posgrado_titulo: '',
    posgrado_anio: '',
    actividad_laboral: '',
    empresa: '',
    cargo: '',
    movilidad_propia: '',
    tipo_vehiculo: '',
    computadora_propia: '',
    internet_estable: '',
    manejo_office: '',
    dias_disponibles: [],
    turno: '',
    iglesia_denominacion: '',
    iglesia_nombre: '',
    pastor_nombre: '',
    pastor_telefono: '',
    lider_nombre: '',
    lider_telefono: '',
    bautizado_agua: '',
    areas_ministerio: '',
    banco_nombre: '',
    banco_sucursal: '',
    titular_nombre: '',
    titular_ci: '',
    tipo_cuenta: '',
    numero_cuenta: '',
    factura_tipo: '',
    factura_emisor: '',
    ruc: '',
  };
}

/* ------------------------------------------------------------------------- */
/* Opciones (los códigos de los CHECK de la tabla)                           */
/* ------------------------------------------------------------------------- */

export type Opcion = { valor: string; label: string };

export const SI_NO: Opcion[] = [
  { valor: 'SI', label: 'Sí' },
  { valor: 'NO', label: 'No' },
];
export const ESTADO_CIVIL: Opcion[] = [
  { valor: 'SOLTERO', label: 'Soltero/a' },
  { valor: 'CASADO', label: 'Casado/a' },
  { valor: 'OTROS', label: 'Otro' },
];
export const VIVE_CON: Opcion[] = [
  { valor: 'SOLO', label: 'Solo/a' },
  { valor: 'PADRES', label: 'Con mis padres' },
  { valor: 'CONYUGE', label: 'Con mi cónyuge' },
  { valor: 'OTROS', label: 'Con otras personas' },
];
export const TALLES: Opcion[] = ['P', 'M', 'G', 'XG', 'XXG', 'XXXG', 'XXXXG', 'XXXXXG'].map((t) => ({ valor: t, label: t }));
export const TIPO_VEHICULO: Opcion[] = [
  { valor: 'AUTO', label: 'Auto' },
  { valor: 'MOTOCICLETA', label: 'Moto' },
];
export const TURNOS: Opcion[] = [
  { valor: 'MANANA', label: 'Mañana' },
  { valor: 'TARDE', label: 'Tarde' },
  { valor: 'MANANA_Y_TARDE', label: 'Mañana y tarde' },
];
export const DIAS: Opcion[] = [
  { valor: 'LUNES', label: 'Lunes' },
  { valor: 'MARTES', label: 'Martes' },
  { valor: 'MIERCOLES', label: 'Miércoles' },
  { valor: 'JUEVES', label: 'Jueves' },
  { valor: 'VIERNES', label: 'Viernes' },
];
export const FACTURA_TIPO: Opcion[] = [
  { valor: 'VIRTUAL', label: 'Electrónica (virtual)' },
  { valor: 'FISICA', label: 'En papel (física)' },
];
export const TIPOS_CUENTA = ['Caja de ahorro', 'Cuenta corriente'];

export type Nivel = 'secundario' | 'tecnico' | 'licenciatura' | 'posgrado';
export type NivelEstudio = {
  nivel: Nivel;
  titulo: string;
  opciones: Opcion[];
  /** Si pide el curso actual ("2/4") cuando lo está cursando. */
  conAnio: boolean;
  ejemplo: string;
};

/** Cada nivel con SUS códigos, como los CHECK (técnico INCONCLUSO, licenciatura INCONCLUSA…). */
export const NIVELES: NivelEstudio[] = [
  {
    nivel: 'secundario',
    titulo: 'Secundaria',
    opciones: [
      { valor: 'CONCLUIDO', label: 'Concluida' },
      { valor: 'INCONCLUSO', label: 'Sin terminar' },
    ],
    conAnio: false,
    ejemplo: 'Bachiller en Ciencias Sociales',
  },
  {
    nivel: 'tecnico',
    titulo: 'Técnico superior',
    opciones: [
      { valor: 'NO', label: 'No hice' },
      { valor: 'CURSANDO', label: 'Cursando' },
      { valor: 'CONCLUIDO', label: 'Concluido' },
      { valor: 'INCONCLUSO', label: 'Lo dejé' },
    ],
    conAnio: true,
    ejemplo: 'Técnico superior en Informática',
  },
  {
    nivel: 'licenciatura',
    titulo: 'Licenciatura',
    opciones: [
      { valor: 'NO', label: 'No hice' },
      { valor: 'CURSANDO', label: 'Cursando' },
      { valor: 'CONCLUIDA', label: 'Concluida' },
      { valor: 'INCONCLUSA', label: 'La dejé' },
    ],
    conAnio: true,
    ejemplo: 'Licenciatura en Ciencias de la Educación',
  },
  {
    nivel: 'posgrado',
    titulo: 'Posgrado',
    opciones: [
      { valor: 'NO', label: 'No hice' },
      { valor: 'CURSANDO', label: 'Cursando' },
      { valor: 'CONCLUIDO', label: 'Concluido' },
      { valor: 'INCONCLUSA', label: 'Lo dejé' },
    ],
    conAnio: true,
    ejemplo: 'Especialización en Didáctica',
  },
];

export const campoNivel = (n: Nivel, parte: 'estado' | 'titulo' | 'anio') => `${n}_${parte}` as CampoTexto;
/** Con título: concluido o cursando. */
export const pideTitulo = (estado: string) => estado === 'CONCLUIDO' || estado === 'CONCLUIDA' || estado === 'CURSANDO';

export const etiquetaDe = (opciones: Opcion[], valor: string) => opciones.find((o) => o.valor === valor)?.label ?? valor;

/* ------------------------------------------------------------------------- */
/* Pasos y validación (las mismas reglas que PKG_POSTULACION_APP_ETHOS)      */
/* ------------------------------------------------------------------------- */

export type PasoId = 'proceso' | 'personales' | 'domicilio' | 'estudios' | 'trabajo' | 'disponibilidad' | 'iglesia' | 'cobro' | 'revisar';

export const PASOS: { id: PasoId; titulo: string }[] = [
  { id: 'proceso', titulo: 'El proceso' },
  { id: 'personales', titulo: 'Datos personales' },
  { id: 'domicilio', titulo: 'Domicilio' },
  { id: 'estudios', titulo: 'Estudios' },
  { id: 'trabajo', titulo: 'Trabajo y recursos' },
  { id: 'disponibilidad', titulo: 'Disponibilidad' },
  { id: 'iglesia', titulo: 'Iglesia' },
  { id: 'cobro', titulo: 'Cobro' },
  { id: 'revisar', titulo: 'Revisar y enviar' },
];

const CAMPOS_PASO: Record<PasoId, Campo[]> = {
  proceso: ['acepta_proceso'],
  personales: ['nombre_completo', 'cedula', 'fecha_nacimiento', 'nacionalidad', 'telefono', 'correo_electronico', 'estado_civil', 'estado_civil_otro', 'vive_con', 'hijos', 'talle_remera'],
  domicilio: ['id_departamento', 'id_ciudad', 'direccion', 'ubicacion_domicilio'],
  estudios: NIVELES.flatMap((n) => [campoNivel(n.nivel, 'estado'), campoNivel(n.nivel, 'titulo'), ...(n.conAnio ? [campoNivel(n.nivel, 'anio')] : [])]),
  trabajo: ['actividad_laboral', 'empresa', 'cargo', 'movilidad_propia', 'tipo_vehiculo', 'computadora_propia', 'internet_estable', 'manejo_office'],
  disponibilidad: ['dias_disponibles', 'turno'],
  iglesia: ['iglesia_denominacion', 'iglesia_nombre', 'pastor_nombre', 'pastor_telefono', 'lider_nombre', 'lider_telefono', 'bautizado_agua', 'areas_ministerio'],
  cobro: ['banco_nombre', 'banco_sucursal', 'titular_nombre', 'titular_ci', 'tipo_cuenta', 'numero_cuenta', 'factura_tipo', 'factura_emisor', 'ruc'],
  revisar: [],
};

/** El paso donde está un campo (para llevar al facilitador al error que marcó el servidor). */
export function pasoDeCampo(campo: string): number {
  const i = PASOS.findIndex((p) => (CAMPOS_PASO[p.id] as string[]).includes(campo));
  return i < 0 ? PASOS.length - 1 : i;
}

const RE_TELEFONO = /^\+?[0-9 ()-]{6,}$/;
const RE_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const RE_CURSO = /^\d{1,2}\/\d{1,2}$/;
const RE_RUC = /^\d{3,}(-\d)?$/;

export const soloCedula = (v: string) => v.replace(/[.\s-]/g, '');
const cedulaValida = (v: string) => /^\d{3,15}$/.test(soloCedula(v));

/** Años cumplidos a hoy, o null si la fecha no es válida. */
export function edadDe(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const h = hoy();
  let edad = h.getFullYear() - a;
  if (h.getMonth() + 1 < me || (h.getMonth() + 1 === me && h.getDate() < d)) edad--;
  return edad;
}

const vacio = (v: string) => !v.trim();

export function validarPaso(id: PasoId, d: Datos): Errores {
  const e: Errores = {};
  const req = (c: CampoTexto, msg: string) => {
    if (vacio(d[c])) e[c] = msg;
  };
  const tel = (c: CampoTexto, msg: string) => {
    if (vacio(d[c])) e[c] = msg;
    else if (!RE_TELEFONO.test(d[c].trim())) e[c] = 'Solo números, espacios, guiones o +.';
  };

  switch (id) {
    case 'proceso':
      if (!d.acepta_proceso) e.acepta_proceso = 'Elegí una opción para seguir.';
      else if (d.acepta_proceso !== 'DE_ACUERDO') e.acepta_proceso = 'Para postularte tenés que estar de acuerdo con el proceso.';
      break;

    case 'personales': {
      req('nombre_completo', 'Escribí tu nombre completo.');
      if (vacio(d.cedula)) e.cedula = 'Escribí tu número de cédula.';
      else if (!cedulaValida(d.cedula)) e.cedula = 'La cédula lleva solo números.';
      const edad = edadDe(d.fecha_nacimiento);
      if (!d.fecha_nacimiento) e.fecha_nacimiento = 'Escribí tu fecha de nacimiento.';
      else if (edad === null || edad < EDAD_MINIMA || edad > EDAD_MAXIMA) e.fecha_nacimiento = 'Revisá la fecha de nacimiento.';
      req('nacionalidad', 'Escribí tu nacionalidad.');
      tel('telefono', 'Escribí tu número de teléfono.');
      if (vacio(d.correo_electronico)) e.correo_electronico = 'Escribí tu correo electrónico.';
      else if (!RE_CORREO.test(d.correo_electronico.trim())) e.correo_electronico = 'El correo no es válido.';
      req('estado_civil', 'Elegí tu estado civil.');
      if (d.estado_civil === 'OTROS') req('estado_civil_otro', 'Contanos cuál es tu estado civil.');
      req('vive_con', 'Elegí con quién vivís.');
      req('hijos', 'Elegí si tenés hijos.');
      break;
    }

    case 'domicilio':
      if (d.id_departamento === null) e.id_departamento = 'Elegí tu departamento.';
      if (d.id_ciudad === null) e.id_ciudad = 'Elegí tu ciudad.';
      req('direccion', 'Escribí la dirección de tu casa.');
      req('ubicacion_domicilio', 'Agregá la ubicación de tu casa.');
      break;

    case 'estudios':
      for (const n of NIVELES) {
        const estado = d[campoNivel(n.nivel, 'estado')];
        if (!estado) e[campoNivel(n.nivel, 'estado')] = 'Elegí una opción.';
        if (pideTitulo(estado)) req(campoNivel(n.nivel, 'titulo'), 'Escribí el nombre del título o la carrera.');
        if (n.conAnio && estado === 'CURSANDO') {
          const c = campoNivel(n.nivel, 'anio');
          if (vacio(d[c])) e[c] = 'Escribí qué curso estás haciendo, por ejemplo 2/4.';
          else if (!RE_CURSO.test(d[c].replace(/\s/g, ''))) e[c] = 'Va como 2/4: el curso que hacés y el total.';
        }
      }
      break;

    case 'trabajo':
      req('actividad_laboral', 'Elegí si trabajás actualmente.');
      if (d.actividad_laboral === 'SI') {
        req('empresa', 'Escribí dónde trabajás.');
        req('cargo', 'Escribí tu cargo.');
      }
      req('movilidad_propia', 'Elegí si tenés movilidad propia.');
      if (d.movilidad_propia === 'SI') req('tipo_vehiculo', 'Elegí el tipo de vehículo.');
      req('computadora_propia', 'Elegí una opción.');
      req('internet_estable', 'Elegí una opción.');
      req('manejo_office', 'Elegí una opción.');
      break;

    case 'disponibilidad':
      if (d.dias_disponibles.length === 0) e.dias_disponibles = 'Elegí al menos un día.';
      req('turno', 'Elegí el turno.');
      break;

    case 'iglesia':
      req('iglesia_denominacion', 'Escribí la denominación de tu iglesia.');
      req('iglesia_nombre', 'Escribí el nombre de tu iglesia.');
      req('pastor_nombre', 'Escribí el nombre del pastor.');
      tel('pastor_telefono', 'Escribí el teléfono del pastor.');
      req('lider_nombre', 'Escribí el nombre de tu líder.');
      tel('lider_telefono', 'Escribí el teléfono de tu líder.');
      req('bautizado_agua', 'Elegí una opción.');
      req('areas_ministerio', 'Contanos en qué áreas servís.');
      break;

    case 'cobro':
      req('banco_nombre', 'Escribí el banco.');
      req('banco_sucursal', 'Escribí la sucursal.');
      req('titular_nombre', 'Escribí el nombre del titular.');
      if (vacio(d.titular_ci)) e.titular_ci = 'Escribí la cédula del titular.';
      else if (!cedulaValida(d.titular_ci)) e.titular_ci = 'La cédula lleva solo números.';
      req('tipo_cuenta', 'Elegí o escribí el tipo de cuenta.');
      req('numero_cuenta', 'Escribí el número de cuenta.');
      req('factura_tipo', 'Elegí el tipo de factura.');
      req('factura_emisor', 'Escribí quién emite la factura.');
      if (vacio(d.ruc)) e.ruc = 'Escribí el RUC.';
      else if (!RE_RUC.test(d.ruc.replace(/\s/g, ''))) e.ruc = 'El RUC va con el dígito verificador: 1234567-8.';
      break;

    case 'revisar':
      break;
  }
  return e;
}

/** El primer paso con errores (o null si está todo bien) y sus errores. */
export function primerPasoConErrores(d: Datos): { paso: number; errores: Errores } | null {
  for (let i = 0; i < PASOS.length; i++) {
    const paso = PASOS[i];
    if (!paso) continue;
    const errores = validarPaso(paso.id, d);
    if (Object.keys(errores).length) return { paso: i, errores };
  }
  return null;
}

/* ------------------------------------------------------------------------- */
/* Backend                                                                   */
/* ------------------------------------------------------------------------- */

export type Postulacion = {
  id: number;
  anio: string;
  /** YYYY-MM-DDTHH:MI, hora de Paraguay. */
  fechaRegistro: string;
  departamento: string;
  ciudad: string;
  datos: Datos;
};

export type EstadoPostulacion = {
  esFacilitador: boolean;
  anio: string;
  /** Si el año lectivo actual está en ANIOS_LECTIVOS. */
  abierta: boolean;
  facilitador: { nombre: string; telefono: string; fechaNacimiento: string };
  /** La del año abierto, si ya la envió. */
  postulacion: Postulacion | null;
  /** La más reciente de otro año, para precargar. */
  anterior: Postulacion | null;
};

export type Lugar = { id: number; nombre: string };
export type Departamento = Lugar & { ciudades: Lugar[] };

export const FALTA_PUBLICAR = 'Falta publicar en el backend los endpoints de mi-postulacion (sql/postulacion_app_ethos.sql).';
/** Un endpoint sin publicar: ORDS responde "Not Found". */
export const faltaPublicar = (mensaje: string) => /not found/i.test(mensaje);

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
/** "Miércoles" → "MIERCOLES" (por si una fila vieja vino escrita a mano). */
const codigoDia = (v: unknown) =>
  s(v)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();

function datosDe(p: Record<string, unknown>): Datos {
  const d = datosVacios();
  for (const k of Object.keys(d) as Campo[]) {
    if (k === 'id_departamento' || k === 'id_ciudad' || k === 'dias_disponibles') continue;
    d[k] = s(p[k]);
  }
  d.id_departamento = num(p.id_departamento);
  d.id_ciudad = num(p.id_ciudad);
  const dias = Array.isArray(p.dias_disponibles) ? p.dias_disponibles.map(codigoDia) : [];
  d.dias_disponibles = DIAS.map((x) => x.valor).filter((v) => dias.includes(v));
  return d;
}

function postulacionDe(v: unknown): Postulacion | null {
  const p = obj(v);
  if (!p) return null;
  return { id: num(p.id) ?? 0, anio: s(p.anio), fechaRegistro: s(p.fecha_registro), departamento: s(p.departamento), ciudad: s(p.ciudad), datos: datosDe(p) };
}

export async function cargarPostulacion(): Promise<EstadoPostulacion> {
  const r = (await authFetch('mi-postulacion')) as Record<string, unknown>;
  const f = obj(r.facilitador) ?? {};
  return {
    esFacilitador: r.es_facilitador === true,
    anio: s(r.anio),
    abierta: r.abierta === true,
    facilitador: { nombre: s(f.nombre), telefono: s(f.telefono), fechaNacimiento: s(f.fecha_nacimiento) },
    postulacion: postulacionDe(r.postulacion),
    anterior: postulacionDe(r.anterior),
  };
}

// Los departamentos y ciudades casi no cambian: se piden una vez por sesión de la app.
let lugaresCache: Promise<Departamento[]> | null = null;

export function cargarLugares(): Promise<Departamento[]> {
  lugaresCache ??= authFetch(`mi-postulacion/lugares?id_pais=${PAIS_POR_DEFECTO}`)
    .then((r) => {
      const deps = Array.isArray((r as { departamentos?: unknown }).departamentos) ? ((r as { departamentos: unknown[] }).departamentos) : [];
      return deps.flatMap((x) => {
        const d = obj(x);
        const id = num(d?.id);
        if (!d || id === null) return [];
        const ciudades = (Array.isArray(d.ciudades) ? d.ciudades : []).flatMap((y) => {
          const c = obj(y);
          const cid = num(c?.id);
          return c && cid !== null ? [{ id: cid, nombre: s(c.nombre) }] : [];
        });
        return [{ id, nombre: s(d.nombre), ciudades }];
      });
    })
    .catch((e: unknown) => {
      lugaresCache = null;
      throw e;
    });
  return lugaresCache;
}

/** Lo que se manda: textos sin espacios de más y, de lo condicional, solo lo que corresponde. */
function payload(d: Datos): Record<string, unknown> {
  const t = (v: string) => v.trim().replace(/[ \t]+/g, ' ');
  const out: Record<string, unknown> = { id_pais: PAIS_POR_DEFECTO };
  for (const k of Object.keys(d) as Campo[]) {
    const v = d[k];
    out[k] = typeof v === 'string' ? t(v) : v;
  }
  out.cedula = soloCedula(d.cedula);
  out.titular_ci = soloCedula(d.titular_ci);
  out.ruc = d.ruc.replace(/\s/g, '');
  out.areas_ministerio = d.areas_ministerio.trim();
  if (d.estado_civil !== 'OTROS') out.estado_civil_otro = '';
  for (const n of NIVELES) {
    const estado = d[campoNivel(n.nivel, 'estado')];
    if (!pideTitulo(estado)) out[campoNivel(n.nivel, 'titulo')] = '';
    if (n.conAnio) out[campoNivel(n.nivel, 'anio')] = estado === 'CURSANDO' ? d[campoNivel(n.nivel, 'anio')].replace(/\s/g, '') : '';
  }
  if (d.actividad_laboral !== 'SI') out.empresa = out.cargo = '';
  if (d.movilidad_propia !== 'SI') out.tipo_vehiculo = '';
  return out;
}

/** Alta o corrección de la del año (lo decide el servidor). Un dato rechazado llega como ErrorDeCampo. */
export async function enviarPostulacion(d: Datos): Promise<{ nueva: boolean }> {
  try {
    const r = (await authFetch('mi-postulacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload(d)),
    })) as { nueva?: unknown };
    return { nueva: r.nueva === true };
  } catch (e) {
    if (e instanceof ErrorApi && typeof e.datos.campo === 'string') throw new ErrorDeCampo(e.message, e.datos.campo);
    throw e;
  }
}

/* ------------------------------------------------------------------------- */
/* Lo cargado y no enviado: solo en memoria, mientras la app está abierta    */
/* ------------------------------------------------------------------------- */

type Borrador = { clave: string; datos: Datos; paso: number };
let borrador: Borrador | null = null;

/** clave = usuario + año: otro usuario en el mismo celular no ve lo de otro. */
export const leerBorrador = (clave: string) => (borrador?.clave === clave ? borrador : null);
export const guardarBorrador = (clave: string, datos: Datos, paso: number) => {
  borrador = { clave, datos, paso };
};
export const borrarBorrador = () => {
  borrador = null;
};

/* ------------------------------------------------------------------------- */
/* Ubicación del domicilio                                                   */
/* ------------------------------------------------------------------------- */

/** "latitud, longitud" del GPS, con 6 decimales (~10 cm). */
export async function ubicacionActual(): Promise<string> {
  const permiso = await Location.requestForegroundPermissionsAsync();
  if (permiso.status !== 'granted') throw new Error('Permití el acceso a la ubicación, o pegá el enlace de Google Maps de tu casa.');
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return `${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`;
}

/** El enlace para ver la ubicación: el que pegó, o un mapa con las coordenadas. */
export function enlaceMapa(ubicacion: string): string | null {
  const v = ubicacion.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(v)) return `https://www.google.com/maps?q=${encodeURIComponent(v.replace(/\s/g, ''))}`;
  return null;
}

/* ------------------------------------------------------------------------- */
/* Fechas                                                                    */
/* ------------------------------------------------------------------------- */

/** YYYY-MM-DD → DD/MM/AAAA */
export const isoADma = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

/** DD/MM/AAAA → YYYY-MM-DD, o '' si no es una fecha real. */
export function dmaAIso(dma: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dma);
  if (!m) return '';
  const [d, me, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(a, me - 1, d);
  if (f.getFullYear() !== a || f.getMonth() !== me - 1 || f.getDate() !== d) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Mientras se tipea: solo números, con las barras puestas solas (DD/MM/AAAA). */
export function mascaraFecha(texto: string): string {
  const n = texto.replace(/\D/g, '').slice(0, 8);
  if (n.length <= 2) return n;
  if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
}
