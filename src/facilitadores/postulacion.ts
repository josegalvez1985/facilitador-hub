// "Mi postulación": el facilitador se postula para el año lectivo (tabla POSTULANTES_FACILITADORES).
// Endpoints mi-postulacion/* (sql/postulacion_app_ethos.sql → PKG_POSTULACION_APP_ETHOS), con el
// ID_FACILITADOR sacado del token en el servidor: la app nunca lo manda.
// Reglas (23/11/2026): el año es el lectivo actual; una postulación por año, que se puede corregir;
// "No de acuerdo" no envía nada; país 1 (Paraguay). Los códigos son los de los CHECK de la tabla
// (ojo: cada nivel de estudio usa los suyos, p. ej. CONCLUIDA en licenciatura).
// Ningún campo es obligatorio para GUARDAR (24/11/2026): "Guardar" lo deja en el servidor sin validar
// (mi-postulacion/borrador → POSTULANTES_FAC_BORRADORES); ENVIARLA pide todo completo. Lo que falta
// se avisa en Inicio (aviso-postulacion.tsx). En el dispositivo nunca se guarda nada (datos
// bancarios): lo no guardado queda solo en memoria mientras la app está abierta.
// Documentos (24/11/2026): foto carnet, cédula de los dos lados, CV, certificado de no agresor,
// antecedentes judiciales y policiales, y el título o la constancia de cada estudio concluido o en
// curso, obligatorios. Se suben a Cloudinary al elegirlos (preset
// fcfacilitadores, firmado por el servidor) y la postulación guarda su enlace (*_url).

import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';

import { authFetch, ErrorApi } from './auth/api';
import { subirACloudinary, type ArchivoLocal } from './cloudinary';
import { esPdf, miniatura, tomarFoto } from './facturas';
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
  // Documentos: el secure_url de Cloudinary, o ''.
  foto_url: string;
  cedula_frente_url: string;
  cedula_dorso_url: string;
  secundario_doc_url: string;
  tecnico_doc_url: string;
  licenciatura_doc_url: string;
  posgrado_doc_url: string;
  cv_archivo: string;
  certificado_no_agresor_archivo: string;
  antecedente_judicial_archivo: string;
  antecedente_policial_archivo: string;
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
    foto_url: '',
    cedula_frente_url: '',
    cedula_dorso_url: '',
    secundario_doc_url: '',
    tecnico_doc_url: '',
    licenciatura_doc_url: '',
    posgrado_doc_url: '',
    cv_archivo: '',
    certificado_no_agresor_archivo: '',
    antecedente_judicial_archivo: '',
    antecedente_policial_archivo: '',
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
/* Documentos (las mismas reglas que PKG_POSTULACION_APP_ETHOS.documento)    */
/* ------------------------------------------------------------------------- */

export type CampoDocumento =
  | 'foto_url'
  | 'cedula_frente_url'
  | 'cedula_dorso_url'
  | 'cv_archivo'
  | 'certificado_no_agresor_archivo'
  | 'antecedente_judicial_archivo'
  | 'antecedente_policial_archivo'
  | `${Nivel}_doc_url`;

export type Documento = {
  campo: CampoDocumento;
  titulo: string;
  ayuda: string;
  /** Solo una foto (la foto carnet); los demás aceptan foto o PDF. */
  soloFoto: boolean;
};

export const CAMPOS_DOCUMENTO: CampoDocumento[] = [
  'foto_url',
  'cedula_frente_url',
  'cedula_dorso_url',
  'cv_archivo',
  'certificado_no_agresor_archivo',
  'antecedente_judicial_archivo',
  'antecedente_policial_archivo',
  ...NIVELES.map((n) => `${n.nivel}_doc_url` as const),
];

/**
 * Los documentos que pide la postulación según lo cargado: siempre la foto carnet, la cédula de
 * los dos lados, el CV y los certificados (no agresor, antecedentes judiciales y policiales); de
 * cada estudio concluido, el título, y del que está cursando, una constancia.
 */
export function documentosRequeridos(d: Datos): Documento[] {
  const docs: Documento[] = [
    { campo: 'foto_url', titulo: 'Foto tipo carnet', ayuda: 'De frente, con buena luz y fondo claro.', soloFoto: true },
    { campo: 'cedula_frente_url', titulo: 'Cédula, frente', ayuda: 'Que se lean bien el número y tu nombre.', soloFoto: false },
    { campo: 'cedula_dorso_url', titulo: 'Cédula, dorso', ayuda: 'El lado de atrás de la cédula.', soloFoto: false },
    { campo: 'cv_archivo', titulo: 'Currículum (CV)', ayuda: 'Tu CV actualizado, mejor en PDF.', soloFoto: false },
    { campo: 'certificado_no_agresor_archivo', titulo: 'Certificado de no agresor', ayuda: 'Certificado de no agresor sexual de niños, niñas y adolescentes.', soloFoto: false },
    { campo: 'antecedente_judicial_archivo', titulo: 'Antecedentes judiciales', ayuda: 'Certificado del Poder Judicial.', soloFoto: false },
    { campo: 'antecedente_policial_archivo', titulo: 'Antecedentes policiales', ayuda: 'Certificado de la Policía.', soloFoto: false },
  ];
  for (const n of NIVELES) {
    const estado = d[campoNivel(n.nivel, 'estado')];
    if (!pideTitulo(estado)) continue;
    const cursando = estado === 'CURSANDO';
    docs.push({
      campo: `${n.nivel}_doc_url`,
      titulo: `${cursando ? 'Constancia de estudios' : 'Título'}: ${n.titulo.toLowerCase()}`,
      ayuda: cursando ? 'Una constancia de que estás cursando, de este año.' : 'El título o el certificado de que terminaste.',
      soloFoto: false,
    });
  }
  return docs;
}

/* ------------------------------------------------------------------------- */
/* Pasos y validación (las mismas reglas que PKG_POSTULACION_APP_ETHOS)      */
/* ------------------------------------------------------------------------- */

export type PasoId = 'proceso' | 'personales' | 'domicilio' | 'estudios' | 'trabajo' | 'disponibilidad' | 'iglesia' | 'cobro' | 'documentos' | 'revisar';

export const PASOS: { id: PasoId; titulo: string }[] = [
  { id: 'proceso', titulo: 'El proceso' },
  { id: 'personales', titulo: 'Datos personales' },
  { id: 'domicilio', titulo: 'Domicilio' },
  { id: 'estudios', titulo: 'Estudios' },
  { id: 'trabajo', titulo: 'Trabajo y recursos' },
  { id: 'disponibilidad', titulo: 'Disponibilidad' },
  { id: 'iglesia', titulo: 'Iglesia' },
  { id: 'cobro', titulo: 'Cobro' },
  { id: 'documentos', titulo: 'Documentos' },
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
  documentos: CAMPOS_DOCUMENTO,
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

    case 'documentos':
      for (const doc of documentosRequeridos(d)) {
        if (vacio(d[doc.campo])) e[doc.campo] = `Falta subir: ${doc.titulo.toLowerCase()}.`;
      }
      break;

    case 'revisar':
      break;
  }
  return e;
}

/** Cómo se llama cada dato en los avisos de "lo que falta". */
const ETIQUETA: Partial<Record<Campo, string>> = {
  acepta_proceso: 'acuerdo con el proceso',
  nombre_completo: 'nombre completo',
  cedula: 'cédula',
  fecha_nacimiento: 'fecha de nacimiento',
  nacionalidad: 'nacionalidad',
  telefono: 'teléfono',
  correo_electronico: 'correo',
  estado_civil: 'estado civil',
  estado_civil_otro: 'cuál es tu estado civil',
  vive_con: 'con quién vivís',
  hijos: 'hijos',
  id_departamento: 'departamento',
  id_ciudad: 'ciudad',
  direccion: 'dirección',
  ubicacion_domicilio: 'ubicación de tu casa',
  secundario_estado: 'secundaria',
  secundario_titulo: 'título de bachiller',
  tecnico_estado: 'técnico superior',
  tecnico_titulo: 'carrera técnica',
  tecnico_anio: 'curso del técnico',
  licenciatura_estado: 'licenciatura',
  licenciatura_titulo: 'carrera de licenciatura',
  licenciatura_anio: 'curso de la licenciatura',
  posgrado_estado: 'posgrado',
  posgrado_titulo: 'nombre del posgrado',
  posgrado_anio: 'curso del posgrado',
  actividad_laboral: 'si trabajás',
  empresa: 'empresa',
  cargo: 'cargo',
  movilidad_propia: 'movilidad propia',
  tipo_vehiculo: 'tipo de vehículo',
  computadora_propia: 'computadora propia',
  internet_estable: 'internet estable',
  manejo_office: 'manejo de Office',
  dias_disponibles: 'días disponibles',
  turno: 'turno',
  iglesia_denominacion: 'denominación',
  iglesia_nombre: 'nombre de la iglesia',
  pastor_nombre: 'pastor',
  pastor_telefono: 'teléfono del pastor',
  lider_nombre: 'líder',
  lider_telefono: 'teléfono del líder',
  bautizado_agua: 'bautismo en agua',
  areas_ministerio: 'áreas en las que servís',
  banco_nombre: 'banco',
  banco_sucursal: 'sucursal',
  titular_nombre: 'titular de la cuenta',
  titular_ci: 'cédula del titular',
  tipo_cuenta: 'tipo de cuenta',
  numero_cuenta: 'número de cuenta',
  factura_tipo: 'tipo de factura',
  factura_emisor: 'emisor de la factura',
  ruc: 'RUC',
};

export type PasoFaltante = { paso: number; titulo: string; campos: string[] };

/**
 * Lo que falta para terminar la postulación (para el aviso de Inicio, la campana y el último
 * paso): por paso, los datos sin completar o mal escritos, y los archivos que faltan subir.
 * Vacío = completa.
 */
export function faltantes(d: Datos): { pasos: PasoFaltante[]; archivos: string[] } {
  const pasos: PasoFaltante[] = [];
  PASOS.forEach((p, i) => {
    if (p.id === 'documentos' || p.id === 'revisar') return;
    const campos = (Object.keys(validarPaso(p.id, d)) as Campo[]).map((c) => ETIQUETA[c] ?? c);
    if (campos.length) pasos.push({ paso: i, titulo: p.titulo, campos });
  });
  const archivos = documentosRequeridos(d)
    .filter((doc) => !d[doc.campo].trim())
    .map((doc) => doc.titulo);
  return { pasos, archivos };
}

export const estaCompleta = (d: Datos) => {
  const f = faltantes(d);
  return f.pasos.length === 0 && f.archivos.length === 0;
};

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
  anioRegistrado: boolean;
  /** Si el período de postulación deja cargar y modificar (FN_POSTULACION_ABIERTA = 'SI'). */
  abierta: boolean;
  /** El período de PERIODOS_POSTULACION (YYYY-MM-DD), o null si no está cargado. */
  periodo: { inicio: string; fin: string; extraordinaria: boolean } | null;
  /** Etapas y requisitos del proceso de ese año (ANIOS_LECTIVOS.PROCESO_POSTULACION), en texto. '' si no está cargado. */
  proceso: string;
  facilitador: { nombre: string; telefono: string; fechaNacimiento: string };
  /** Si ya es facilitador: lo que se sabe de él en FACILITADORES, con los códigos de la postulación (para precargar). */
  deFacilitador: Partial<Datos>;
  /** La del año abierto, si ya la envió. */
  postulacion: Postulacion | null;
  /** La más reciente de otro año, para precargar. */
  anterior: Postulacion | null;
  /** Lo guardado sin terminar este año (en el servidor, POSTULANTES_FAC_BORRADORES). */
  guardada: Guardada | null;
};

/** Postulación guardada sin terminar: lo cargado, el paso donde quedó y cuándo (hora de Paraguay). */
export type Guardada = { datos: Datos; paso: number; fecha: string };

export type Lugar = { id: number; nombre: string };
export type Departamento = Lugar & { ciudades: Lugar[] };

/**
 * Una línea sobre el período para mostrar: "Abierta hasta el 15/12/2026", "Abre el 01/12/2026",
 * "Cerró el 15/12/2026". Compara con la fecha del dispositivo (fechas.ts).
 */
export function textoPeriodo(e: Pick<EstadoPostulacion, 'abierta' | 'periodo'>): string {
  const p = e.periodo;
  if (!p) return e.abierta ? '' : 'La coordinación todavía no habilitó el período de postulación.';
  const hoyIso = (() => {
    const h = hoy();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
  })();
  if (e.abierta) return p.extraordinaria && hoyIso > p.fin ? 'Habilitada de forma extraordinaria por la coordinación.' : `Abierta hasta el ${isoADma(p.fin)}.`;
  if (hoyIso < p.inicio) return `El período de postulación abre el ${isoADma(p.inicio)}.`;
  return `El período de postulación cerró el ${isoADma(p.fin)}.`;
}

/** Hasta cuántos días antes del cierre se destaca el plazo. */
const DIAS_AVISO_CIERRE = 7;

/**
 * "Cierra hoy" / "Cierra mañana" / "Cierra en 3 días" cuando el período está abierto y falta poco
 * (hasta 7 días); si no, null. Compara con la fecha del dispositivo (fechas.ts).
 */
export function textoCierre(e: Pick<EstadoPostulacion, 'abierta' | 'periodo'>): string | null {
  const p = e.periodo;
  if (!e.abierta || !p) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(p.fin);
  if (!m) return null;
  const h = hoy();
  const dias = Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - Date.UTC(h.getFullYear(), h.getMonth(), h.getDate())) / 86_400_000);
  if (dias < 0 || dias > DIAS_AVISO_CIERRE) return null;
  return dias === 0 ? 'Cierra hoy' : dias === 1 ? 'Cierra mañana' : `Cierra en ${dias} días`;
}

/** Cuántos pasos hay que completar (todos menos el último, "Revisar y enviar"). */
export const PASOS_A_COMPLETAR = PASOS.length - 1;

/**
 * Cuántos de esos pasos ya están completos: los de datos sin faltantes y, en "Documentos", sin
 * archivos pendientes.
 */
export function pasosCompletos(f: { pasos: PasoFaltante[]; archivos: string[] }): number {
  const pendientes = f.pasos.length + (f.archivos.length > 0 ? 1 : 0);
  return Math.max(0, PASOS_A_COMPLETAR - pendientes);
}

/** El paso donde retomar: el primero con datos o archivos faltantes; si no falta nada, "Revisar y enviar". */
export function pasoParaRetomar(d: Datos): number {
  const f = faltantes(d);
  const iDocs = PASOS.findIndex((p) => p.id === 'documentos');
  const candidatos = [...f.pasos.map((p) => p.paso), ...(f.archivos.length ? [iDocs] : [])];
  return candidatos.length ? Math.min(...candidatos) : PASOS.length - 1;
}

/** Miniatura de un documento subido, o null si no se puede armar (un archivo "raw" no admite transformaciones). */
export function miniaturaDocumento(url: string): string | null {
  if (!url || url.includes('/raw/upload/')) return null;
  return miniatura(url, 160);
}

/** "PDF", "Foto" o "Archivo" (un enlace sin extensión de imagen ni PDF, p. ej. un "raw" de Cloudinary). */
export function tipoDeArchivo(url: string): 'PDF' | 'Foto' | 'Archivo' {
  if (esPdf(url)) return 'PDF';
  return url.includes('/raw/upload/') ? 'Archivo' : 'Foto';
}

export const FALTA_PUBLICAR ='Falta publicar en el backend los endpoints de mi-postulacion (sql/postulacion_app_ethos.sql).';
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
    // Un servidor viejo no manda anio_registrado: ahí "abierta" significaba que el año existe.
    anioRegistrado: typeof r.anio_registrado === 'boolean' ? r.anio_registrado : r.abierta === true,
    abierta: r.abierta === true,
    periodo: (() => {
      const p = obj(r.periodo);
      return p ? { inicio: s(p.fecha_inicio), fin: s(p.fecha_fin), extraordinaria: p.extraordinaria === true } : null;
    })(),
    proceso: textoDeProceso(typeof r.proceso === 'string' ? r.proceso : ''),
    facilitador: { nombre: s(f.nombre), telefono: s(f.telefono), fechaNacimiento: s(f.fecha_nacimiento) },
    deFacilitador: datosDeFacilitador(f),
    postulacion: postulacionDe(r.postulacion),
    anterior: postulacionDe(r.anterior),
    guardada: guardadaDe(r.borrador),
  };
}

/**
 * PROCESO_POSTULACION a texto para mostrar: puede venir como texto plano o como HTML del editor de
 * APEX. Del HTML quedan los párrafos y las viñetas (•); el resto de las etiquetas se saca.
 */
export function textoDeProceso(v: string): string {
  const t = v.replace(/\r\n/g, '\n');
  // Venga como venga (un renglón, con saltos de línea o HTML), se ordena igual en la app.
  return ordenarProceso(/<[a-z][\s\S]*>/i.test(t) ? deHtml(t) : t);
}

/** HTML del editor de APEX → texto: párrafos y viñetas (•); el resto de las etiquetas se saca. */
function deHtml(v: string): string {
  return v
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    // </li> no: cada <li> ya abre su renglón (si no, quedan renglones en blanco entre viñetas).
    .replace(/<\/(p|div|h[1-6]|ul|ol|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Un proceso escrito en un solo renglón (como se carga desde APEX), separado para leerlo:
 * - "1) … 2) …" y "a) … b) …": un párrafo cada uno.
 * - Un título en mayúsculas después de un punto (". REQUISITOS …"): párrafo nuevo.
 * - " - " después de ":" dentro del mismo párrafo ("documentos: - Cédula - CV"): viñetas.
 *   Antes del ":" el guion se deja ("POSTULACIÓN - FACILITADORES").
 */
function ordenarProceso(texto: string): string {
  // Renglones que ya empiezan con "-" o "*" son viñetas, haya o no ":" antes.
  const t = texto.trim().replace(/\n[ \t]*[-*•][ \t]+/g, '\n• ');
  const parrafos = t
    .replace(/\s+(?=\d{1,2}\)\s)/g, '\n\n')
    .replace(/\s+(?=[a-z]\)\s)/g, '\n\n')
    .replace(/\.\s+(?=[A-ZÁÉÍÓÚÑ]{6,}\b)/g, '.\n\n')
    .split('\n\n');
  return parrafos
    .map((p) => {
      const i = p.indexOf(':');
      if (i < 0) return p;
      return p.slice(0, i + 1) + p.slice(i + 1).replace(/\s+-\s+/g, '\n• ');
    })
    .join('\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ------------------------------------------------------------------------- */
/* Precarga desde FACILITADORES (si ya es facilitador)                       */
/* ------------------------------------------------------------------------- */

/** "Sí", "si", "S" → "SI"; "No", "N" → "NO"; otra cosa → "". */
const siNo = (v: unknown) => {
  const t = codigoDia(v);
  return /^S(I)?$/.test(t) ? 'SI' : /^N(O)?$/.test(t) ? 'NO' : '';
};

/**
 * Los datos de FACILITADORES (texto libre en el sistema APEX) llevados a los códigos de la
 * postulación. Lo que no se reconoce queda vacío para que lo complete. Nacionalidad no: en
 * FACILITADORES es un id de NACIONALIDADES y no se conoce esa tabla.
 */
function datosDeFacilitador(f: Record<string, unknown>): Partial<Datos> {
  const d: Partial<Datos> = {};
  const txt = (clave: string) => s(f[clave]);
  const poner = <K extends keyof Datos>(campo: K, valor: Datos[K] | '' | null) => {
    if (valor !== '' && valor !== null) d[campo] = valor as Datos[K];
  };

  poner('nombre_completo', txt('nombre'));
  poner('cedula', soloCedula(txt('cedula')));
  poner('fecha_nacimiento', /^\d{4}-\d{2}-\d{2}$/.test(txt('fecha_nacimiento')) ? txt('fecha_nacimiento') : '');
  poner('telefono', txt('telefono'));
  poner('correo_electronico', txt('email').toLowerCase());

  const civil = codigoDia(f.estado_civil);
  if (civil) {
    if (civil.startsWith('SOLTER')) poner('estado_civil', 'SOLTERO');
    else if (civil.startsWith('CASAD')) poner('estado_civil', 'CASADO');
    else {
      poner('estado_civil', 'OTROS');
      poner('estado_civil_otro', txt('estado_civil'));
    }
  }
  const vive = codigoDia(f.con_quien_vive);
  if (vive) poner('vive_con', /\bSOL[OA]\b/.test(vive) ? 'SOLO' : /PADRE|MADRE/.test(vive) ? 'PADRES' : /CONYUGE|ESPOS|PAREJA|MARIDO/.test(vive) ? 'CONYUGE' : 'OTROS');
  poner('hijos', siNo(f.hijos));

  // Domicilio: solo de Paraguay (la postulación es siempre país 1).
  if ((num(f.id_pais) ?? PAIS_POR_DEFECTO) === PAIS_POR_DEFECTO) {
    poner('id_departamento', num(f.id_departamento));
    poner('id_ciudad', num(f.id_ciudad));
  }
  poner('direccion', txt('direccion'));
  poner('ubicacion_domicilio', txt('ubicacion'));

  poner('movilidad_propia', siNo(f.vehiculo));
  const vehiculo = codigoDia(f.tipo_vehiculo);
  if (vehiculo) poner('tipo_vehiculo', /MOTO/.test(vehiculo) ? 'MOTOCICLETA' : /AUTO|CAMIONETA|COCHE/.test(vehiculo) ? 'AUTO' : '');
  poner('computadora_propia', siNo(f.computadora));
  poner('internet_estable', siNo(f.internet));
  poner('manejo_office', siNo(f.office));

  poner('iglesia_denominacion', txt('denominacion'));
  poner('iglesia_nombre', txt('nombre_iglesia'));
  poner('pastor_nombre', txt('nombre_pastor'));
  poner('pastor_telefono', txt('telefono_pastor'));
  poner('lider_nombre', txt('nombre_lider'));
  poner('lider_telefono', txt('telefono_lider'));
  poner('bautizado_agua', siNo(f.bautizado_agua));
  poner('areas_ministerio', txt('area_servicio'));

  poner('banco_nombre', txt('banco'));
  poner('banco_sucursal', txt('sucursal'));
  poner('titular_nombre', txt('titular'));
  poner('titular_ci', soloCedula(txt('titular_ci')));
  const cuenta = codigoDia(f.tipo_cuenta);
  poner('tipo_cuenta', /AHORRO/.test(cuenta) ? 'Caja de ahorro' : /CORRIENTE/.test(cuenta) ? 'Cuenta corriente' : txt('tipo_cuenta'));
  poner('numero_cuenta', txt('numero_cuenta'));
  poner('factura_emisor', txt('emisor'));
  poner('ruc', txt('ruc').replace(/\s/g, ''));
  const factura = codigoDia(f.tipo_factura);
  if (factura) poner('factura_tipo', /VIRTUAL|ELECTR/.test(factura) ? 'VIRTUAL' : /FISIC|PAPEL|PREIMPRES/.test(factura) ? 'FISICA' : '');
  return d;
}

function guardadaDe(v: unknown): Guardada | null {
  const b = obj(v);
  if (!b || typeof b.datos !== 'string') return null;
  try {
    const datos = obj(JSON.parse(b.datos));
    if (!datos) return null;
    const paso = Number(b.paso);
    return { datos: datosDe(datos), paso: Number.isInteger(paso) && paso >= 0 && paso < PASOS.length ? paso : 0, fecha: s(b.fecha) };
  } catch {
    return null;
  }
}

/**
 * Guarda lo cargado SIN TERMINAR, en el servidor y sin validar (ningún campo es obligatorio para
 * guardar). La postulación queda terminada recién al enviarla completa (enviarPostulacion).
 * - `datos`: el formulario tal cual, para retomarlo en el mismo punto.
 * - `postulacion`: lo mismo que mandaría el envío; el servidor guarda lo válido en
 *   POSTULANTES_FACILITADORES con ESTADO INCOMPLETO, así los administradores ya ven lo cargado.
 */
export async function guardarSinTerminar(d: Datos, paso: number): Promise<void> {
  await authFetch('mi-postulacion/borrador', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paso, datos: JSON.stringify(d), postulacion: JSON.stringify(payload(d)) }),
  });
}

/** Descarta lo guardado sin terminar; el servidor borra también sus documentos. DELETE sin cuerpo. */
export async function descartarGuardada(): Promise<void> {
  await authFetch('mi-postulacion/borrador', { method: 'DELETE' });
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
    if (!pideTitulo(estado)) out[campoNivel(n.nivel, 'titulo')] = out[`${n.nivel}_doc_url`] = '';
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

/**
 * Elimina la postulación del año abierto (para cargarla de nuevo). El servidor borra también sus
 * documentos de Cloudinary. DELETE sin cuerpo ni Content-Type (ORDS da 400 si no).
 */
export async function eliminarPostulacion(): Promise<void> {
  await authFetch('mi-postulacion', { method: 'DELETE' });
}

/* ------------------------------------------------------------------------- */
/* Subida de documentos (directo a Cloudinary, preset fcfacilitadores)        */
/* ------------------------------------------------------------------------- */

/** Tope de un PDF (el de Cloudinary para un archivo). Las fotos se achican solas a 3 MB. */
const TOPE_PDF = 10 * 1024 * 1024;

/** Saca una foto o la elige de la galería (achicada a JPEG). null si se cancela. */
export async function fotoDeDocumento(origen: 'camara' | 'galeria'): Promise<ArchivoLocal | null> {
  const f = await tomarFoto(origen);
  return f ? { uri: f.uri, nombre: 'documento.jpg', tipo: 'image/jpeg' } : null;
}

/** Un PDF del celular o la computadora. null si se cancela. */
export async function pdfDeDocumento(): Promise<ArchivoLocal | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
  const a = r.canceled ? undefined : r.assets[0];
  if (!a) return null;
  if (a.size && a.size > TOPE_PDF) throw new Error('El PDF pesa más de 10 MB. Probá subiendo una foto del documento.');
  return { uri: a.uri, nombre: a.name || 'documento.pdf', tipo: a.mimeType || 'application/pdf', file: a.file };
}

/**
 * Sube el documento con la firma de POST mi-postulacion/firma-documento y devuelve su enlace.
 * Queda en Cloudinary aunque la postulación no se envíe; al reemplazarlo en una postulación ya
 * enviada, el servidor borra el anterior.
 */
export function subirDocumento(archivo: ArchivoLocal): Promise<string> {
  return subirACloudinary('mi-postulacion/firma-documento', archivo, 'Todavía no se pueden subir documentos. Avisale a la coordinación.');
}

/**
 * Borra de Cloudinary un documento que el usuario quitó o reemplazó. El servidor solo borra lo que
 * le firmó a este usuario y lo que ninguna postulación guardada usa (eso se borra al guardar la
 * corrección). Es limpieza: si falla, no frena al usuario. DELETE sin cuerpo (ORDS da 400 si no).
 */
export function quitarDocumento(url: string): void {
  if (!url) return;
  authFetch(`mi-postulacion/documento?url=${encodeURIComponent(url)}`, { method: 'DELETE' }).catch(() => {});
}

/** Quita de Cloudinary los documentos de un borrador descartado (los ya guardados quedan). */
export function quitarDocumentosDe(d: Datos): void {
  for (const c of CAMPOS_DOCUMENTO) quitarDocumento(d[c]);
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
