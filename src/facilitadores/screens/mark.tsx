// "Marcar" = página 2 "Intervención" de APEX 193573, con el mismo orden de campos:
// Institución → Horario → Grado · Sección · Turno · Énfasis → Manual → Índice →
// ¿Desarrollo? → Motivo (solo si "No") → Observación → Guardar.
//
// Igual que en APEX:
// - Las listas son en cascada (cada cambio recarga las que dependen de él).
// - Las listas sin opción nula toman la primera opción; Institución e Índice usan su
//   valor por defecto de la página si está en la lista.
// - Motivo se muestra solo con "No" (acciones dinámicas Mostrar / Ocultar).
// - La ubicación se pide al abrir (PosicionActual).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal as RNModal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpen, Building2, Check, ChevronDown, Clock3, GraduationCap, MapPin, MessageSquareText, RefreshCw, Save, Search, X, type LucideIcon } from 'lucide-react-native';

import {
  cargarClase,
  cargarHorarios,
  cargarIndices,
  cargarInicio,
  COLOR_MANUAL,
  ErrorDeCampo,
  guardarIntervencion,
  validar,
  type Clase,
  type Formulario,
  type Indices,
  type Inicio,
  type Opcion,
} from '../intervenciones';
import { radius } from '../theme';
import { makeStyles, useTheme } from '../theme-provider';
import { useToast } from '../toast';
import { useUbicacion } from '../ubicacion';
import { Button, Card, Modal, ModalActions, ModalText, PageTitle, Text } from '../ui';

const VACIO: Formulario = {
  id_institucion: null,
  id_postulacion: null,
  grado: null,
  seccion: null,
  turno: null,
  id_enfasis: null,
  manual: null,
  id_indice: null,
  si_no: null,
  motivo_desarrollo: null,
  observacion: '',
};

type EstadoInicio = { tipo: 'cargando' } | { tipo: 'error'; mensaje: string } | { tipo: 'listo'; datos: Inicio };

const mensajeDe = (e: unknown) => (e instanceof Error ? e.message : 'No se pudo cargar');
const etiquetaDe = <T,>(ops: Opcion[] | undefined, v: T) => ops?.find((o) => o.valor === v)?.etiqueta ?? '';

export function MarkScreen() {
  const { colors } = useTheme();
  const s = useStyles();
  const router = useRouter();
  const toast = useToast();
  const [inicio, setInicio] = useState<EstadoInicio>({ tipo: 'cargando' });
  const [intentoInicio, setIntentoInicio] = useState(0);
  const [form, setForm] = useState<Formulario>(VACIO);
  const [horarios, setHorarios] = useState<Opcion<number>[] | null>(null);
  const [clase, setClase] = useState<Clase | null>(null);
  const [indices, setIndices] = useState<Indices | null>(null);
  const [cargando, setCargando] = useState({ horarios: false, clase: false, indices: false });
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Cada nivel de la cascada descarta respuestas viejas (si el usuario cambió antes de que llegaran).
  const pedido = useRef({ horarios: 0, clase: 0, indices: 0 });

  const requiereUbicacion = inicio.tipo === 'listo' ? inicio.datos.requiereUbicacion : true;
  // El GPS se enciende recién cuando el servidor confirma que este facilitador necesita ubicación
  // (FACILITADORES.IND_UBICACION_POSTULACION distinto de 'No'). A quien no la necesita no se le
  // pide permiso ni se envían coordenadas: el servidor guarda 0, como APEX.
  const { ubicacion, reintentar: reintentarUbicacion } = useUbicacion(inicio.tipo === 'listo' && inicio.datos.requiereUbicacion);

  /* ------------------------------- Cascada ------------------------------- */

  const refrescarIndices = (idPostulacion: number | null, manual: string | null, grado: string | null, turno: number | null) => {
    const tk = ++pedido.current.indices;
    setIndices(null);
    setForm((f) => ({ ...f, id_indice: null }));
    if (idPostulacion === null || !manual || !grado || turno === null) return;
    setCargando((c) => ({ ...c, indices: true }));
    cargarIndices({ idPostulacion, manual, grado, turno })
      .then((r) => {
        if (tk !== pedido.current.indices) return;
        setIndices(r);
        const def = r.indices.some((o) => o.valor === r.indicePorDefecto) ? r.indicePorDefecto : (r.indices[0]?.valor ?? null);
        setForm((f) => ({ ...f, id_indice: def }));
      })
      .catch((e: unknown) => tk === pedido.current.indices && setErrorCarga(mensajeDe(e)))
      .finally(() => tk === pedido.current.indices && setCargando((c) => ({ ...c, indices: false })));
  };

  const elegirHorario = (idInstitucion: number, idPostulacion: number | null) => {
    const tk = ++pedido.current.clase;
    setForm((f) => ({ ...f, id_postulacion: idPostulacion, grado: null, seccion: null, turno: null, id_enfasis: null, manual: null, id_indice: null }));
    setClase(null);
    setIndices(null);
    ++pedido.current.indices;
    if (idPostulacion === null) return;
    setCargando((c) => ({ ...c, clase: true }));
    cargarClase(idInstitucion, idPostulacion)
      .then((c) => {
        if (tk !== pedido.current.clase) return;
        setClase(c);
        const sel = {
          grado: c.grados[0]?.valor ?? null,
          seccion: c.secciones[0]?.valor ?? null,
          turno: c.turnos[0]?.valor ?? null,
          id_enfasis: c.enfasis[0]?.valor ?? null,
          manual: c.manuales[0]?.valor ?? null,
        };
        setForm((f) => ({ ...f, ...sel }));
        refrescarIndices(idPostulacion, sel.manual, sel.grado, sel.turno);
      })
      .catch((e: unknown) => tk === pedido.current.clase && setErrorCarga(mensajeDe(e)))
      .finally(() => tk === pedido.current.clase && setCargando((c) => ({ ...c, clase: false })));
  };

  const elegirInstitucion = (idInstitucion: number | null) => {
    const tk = ++pedido.current.horarios;
    setForm((f) => ({ ...f, id_institucion: idInstitucion, id_postulacion: null, grado: null, seccion: null, turno: null, id_enfasis: null, manual: null, id_indice: null }));
    setHorarios(null);
    setClase(null);
    setIndices(null);
    ++pedido.current.clase;
    ++pedido.current.indices;
    if (idInstitucion === null) return;
    setCargando((c) => ({ ...c, horarios: true }));
    cargarHorarios(idInstitucion)
      .then((hs) => {
        if (tk !== pedido.current.horarios) return;
        setHorarios(hs);
        elegirHorario(idInstitucion, hs[0]?.valor ?? null);
      })
      .catch((e: unknown) => tk === pedido.current.horarios && setErrorCarga(mensajeDe(e)))
      .finally(() => tk === pedido.current.horarios && setCargando((c) => ({ ...c, horarios: false })));
  };

  // Carga inicial: LOV de instituciones + su valor por defecto (si está en la lista).
  useEffect(() => {
    let vigente = true;
    cargarInicio()
      .then((datos) => {
        if (!vigente) return;
        setInicio({ tipo: 'listo', datos });
        const def = datos.instituciones.some((i) => i.valor === datos.institucionPorDefecto) ? datos.institucionPorDefecto : null;
        if (def !== null) elegirInstitucion(def);
      })
      .catch((e: unknown) => vigente && setInicio({ tipo: 'error', mensaje: mensajeDe(e) }));
    return () => {
      vigente = false;
    };
    // elegirInstitucion se recrea en cada render; la carga inicial depende solo del intento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentoInicio]);

  const actualizar = (cambio: Partial<Formulario>) => {
    setForm((f) => ({ ...f, ...cambio }));
    setErrores((e) => {
      const n = { ...e };
      for (const k of Object.keys(cambio)) delete n[k];
      return n;
    });
  };

  /* -------------------------------- Guardar ------------------------------- */

  const ubicacionLista = ubicacion.estado === 'lista';
  const pedirConfirmacion = () => {
    const e = validar(form, { requerida: requiereUbicacion, lista: ubicacionLista });
    setErrores(e);
    if (Object.keys(e).length === 0) setConfirmar(true);
  };

  const guardar = async () => {
    setConfirmar(false);
    if (form.id_institucion === null || form.id_postulacion === null || !form.grado || form.turno === null || !form.manual || form.id_indice === null || !form.si_no) return;
    setGuardando(true);
    try {
      await guardarIntervencion({
        id_institucion: form.id_institucion,
        id_postulacion: form.id_postulacion,
        grado: form.grado,
        seccion: form.seccion,
        turno: form.turno,
        id_enfasis: form.id_enfasis,
        manual: form.manual,
        id_indice: form.id_indice,
        si_no: form.si_no,
        motivo_desarrollo: form.si_no === 'No' ? form.motivo_desarrollo : null,
        observacion: form.observacion.trim() || null,
        latitud: ubicacion.estado === 'lista' ? ubicacion.latitud : null,
        longitud: ubicacion.estado === 'lista' ? ubicacion.longitud : null,
      });
      toast.success('Intervención registrada');
      // APEX cierra el diálogo ("Cerrar Recuadro de Diálogo").
      setForm(VACIO);
      router.navigate('/');
    } catch (e) {
      if (e instanceof ErrorDeCampo && e.campo) setErrores({ [e.campo]: e.message });
      else setErrores({ general: mensajeDe(e) });
    } finally {
      setGuardando(false);
    }
  };

  /* --------------------------------- Vista -------------------------------- */

  const encabezado = <PageTitle title="Registrar intervención" subtitle="Marcá tu clase de hoy en pocos pasos." />;

  if (inicio.tipo === 'cargando') {
    return (
      <>
        {encabezado}
        <View style={s.centro}>
          <ActivityIndicator color={colors.primaryText} />
          <Text color={colors.mutedForeground}>Cargando tus instituciones…</Text>
        </View>
      </>
    );
  }
  if (inicio.tipo === 'error') {
    return (
      <>
        {encabezado}
        <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
          <Text accessibilityRole="alert" color={colors.destructive} style={{ textAlign: 'center' }}>
            {/not found/i.test(inicio.mensaje) ? 'Falta publicar en el backend los endpoints de mis-intervenciones (sql/intervenciones_app_ethos.sql).' : inicio.mensaje}
          </Text>
          <Button variant="outline" icon={RefreshCw} label="Reintentar" onPress={() => {
            setInicio({ tipo: 'cargando' });
            setIntentoInicio((n) => n + 1);
          }} />
        </Card>
      </>
    );
  }
  if (!inicio.datos.esFacilitador) {
    return (
      <>
        {encabezado}
        <View style={s.centro}>
          <Text color={colors.mutedForeground} style={{ textAlign: 'center' }}>
            Tu usuario no está registrado como facilitador.{'\n'}No podés registrar intervenciones.
          </Text>
        </View>
      </>
    );
  }

  const d = inicio.datos;
  const manualColor = (m: string) => COLOR_MANUAL[m] ?? colors.border;
  const resumen: [string, string][] = [
    ['Institución', etiquetaDe(d.instituciones, form.id_institucion)],
    ['Horario', etiquetaDe(horarios ?? [], form.id_postulacion)],
    ['Clase', [form.grado, form.seccion, etiquetaDe(clase?.turnos, form.turno)].filter(Boolean).join(' · ')],
    ['Manual', form.manual ?? ''],
    ['Índice', etiquetaDe(indices?.indices, form.id_indice)],
    ['¿Desarrolló?', form.si_no === 'No' ? `No · ${form.motivo_desarrollo ?? ''}` : (form.si_no ?? '')],
  ];

  return (
    <>
      {encabezado}

      <UbicacionBanner ubicacion={ubicacion} requerida={d.requiereUbicacion} error={errores.ubicacion} onReintentar={reintentarUbicacion} />
      {errorCarga && (
        <Card style={{ marginBottom: 12 }}>
          <Text accessibilityRole="alert" size={12} color={colors.destructive}>
            {errorCarga}
          </Text>
        </Card>
      )}

      <Paso n={1} titulo="¿Dónde?" icon={Building2}>
        <Campo etiqueta="Institución" requerido error={errores.id_institucion}>
          <Selector
            titulo="Institución"
            placeholder={d.instituciones.length ? 'Elegí la institución' : 'No hay instituciones disponibles'}
            opciones={d.instituciones}
            valor={form.id_institucion}
            buscador
            onCambiar={(v) => {
              actualizar({ id_institucion: v as number });
              elegirInstitucion(v as number);
            }}
          />
        </Campo>
        <Campo etiqueta="Horario" requerido error={errores.id_postulacion} cargando={cargando.horarios}>
          <Chips
            opciones={horarios ?? []}
            valor={form.id_postulacion}
            vacio={form.id_institucion === null ? 'Primero elegí la institución' : 'Sin horarios pendientes para hoy'}
            icono={Clock3}
            onCambiar={(v) => {
              actualizar({ id_postulacion: v as number });
              if (form.id_institucion !== null) elegirHorario(form.id_institucion, v as number);
            }}
          />
        </Campo>
      </Paso>

      <Paso n={2} titulo="Clase" icon={GraduationCap} cargando={cargando.clase}>
        {/* Ficha compacta: casi siempre cada dato tiene una sola opción por horario. */}
        <View style={s.ficha}>
          <Casilla etiqueta="Grado" requerido error={errores.grado} opciones={clase?.grados ?? []} valor={form.grado} onCambiar={(v) => {
            actualizar({ grado: v as string });
            refrescarIndices(form.id_postulacion, form.manual, v as string, form.turno);
          }} />
          <Casilla etiqueta="Sección" error={errores.seccion} opciones={clase?.secciones ?? []} valor={form.seccion} onCambiar={(v) => actualizar({ seccion: v as string | null })} />
          <Casilla etiqueta="Turno" requerido error={errores.turno} opciones={clase?.turnos ?? []} valor={form.turno} onCambiar={(v) => {
            actualizar({ turno: v as number });
            refrescarIndices(form.id_postulacion, form.manual, form.grado, v as number);
          }} />
          <Casilla etiqueta="Énfasis" error={errores.id_enfasis} opciones={clase?.enfasis ?? []} valor={form.id_enfasis} onCambiar={(v) => actualizar({ id_enfasis: v as number | null })} />
        </View>
        {[errores.grado, errores.seccion, errores.turno, errores.id_enfasis].filter(Boolean).map((e) => (
          <Text key={e} accessibilityRole="alert" size={11} color={colors.destructive} style={{ marginTop: 6 }}>
            {e}
          </Text>
        ))}
      </Paso>

      <Paso n={3} titulo="Contenido" icon={BookOpen} cargando={cargando.indices}>
        <Campo etiqueta="Manual" requerido error={errores.manual}>
          <Chips
            opciones={clase?.manuales ?? []}
            valor={form.manual}
            vacio={form.id_postulacion === null ? 'Primero elegí el horario' : '—'}
            colorDe={(v) => manualColor(String(v))}
            onCambiar={(v) => {
              actualizar({ manual: v as string });
              refrescarIndices(form.id_postulacion, v as string, form.grado, form.turno);
            }}
          />
        </Campo>
        <Campo etiqueta="Índice del manual" requerido error={errores.id_indice}>
          <Selector
            titulo="Índice del manual"
            placeholder={indices && !indices.indices.length ? 'Todos los índices ya fueron desarrollados' : 'Elegí el índice'}
            opciones={indices?.indices ?? []}
            valor={form.id_indice}
            buscador
            colorBorde={form.manual ? manualColor(form.manual) : undefined}
            onCambiar={(v) => actualizar({ id_indice: v as number })}
          />
        </Campo>
      </Paso>

      <Paso n={4} titulo="¿Desarrolló la clase?" icon={Check}>
        <Campo error={errores.si_no}>
          <View style={s.segmento} accessibilityRole="radiogroup">
            {(['Si', 'No'] as const).map((op) => {
              const activo = form.si_no === op;
              return (
                <Pressable
                  key={op}
                  accessibilityRole="radio"
                  accessibilityLabel={op === 'Si' ? 'Sí, desarrollé la clase' : 'No desarrollé la clase'}
                  accessibilityState={{ checked: activo }}
                  onPress={() => actualizar({ si_no: op, ...(op === 'Si' ? { motivo_desarrollo: null } : {}) })}
                  style={[s.segmentoOp, activo && (op === 'Si' ? s.segmentoSi : s.segmentoNo)]}
                >
                  <Text weight="bold" color={activo ? (op === 'Si' ? colors.success : colors.destructive) : colors.foreground}>
                    {op === 'Si' ? 'Sí' : 'No'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Campo>
        {form.si_no === 'No' && (
          <Campo etiqueta="Motivo" requerido error={errores.motivo_desarrollo}>
            <Chips opciones={d.motivos.map((m) => ({ valor: m, etiqueta: m }))} valor={form.motivo_desarrollo} onCambiar={(v) => actualizar({ motivo_desarrollo: v as string })} />
          </Campo>
        )}
      </Paso>

      <Paso n={5} titulo="Observación" icon={MessageSquareText}>
        <Campo error={errores.observacion} requerido={form.si_no === 'No' && form.motivo_desarrollo === 'Otros'}>
          <TextInput
            value={form.observacion}
            onChangeText={(t) => actualizar({ observacion: t })}
            placeholder="Contá cómo fue la clase (opcional)"
            placeholderTextColor={colors.mutedForeground}
            keyboardAppearance={colors.scheme}
            multiline
            maxLength={1000}
            style={[s.textarea, errores.observacion ? { borderColor: colors.destructive } : null]}
            accessibilityLabel="Observación"
          />
          <Text size={10} color={colors.mutedForeground} style={{ textAlign: 'right', marginTop: 4 }}>
            {form.observacion.length}/1000
          </Text>
        </Campo>
      </Paso>

      {errores.general && (
        <Text accessibilityRole="alert" color={colors.destructive} style={{ marginBottom: 12 }}>
          {errores.general}
        </Text>
      )}
      {Object.keys(errores).length > 0 && !errores.general && (
        <Text accessibilityRole="alert" size={12} color={colors.destructive} style={{ marginBottom: 12 }}>
          Revisá los campos marcados.
        </Text>
      )}
      <Button icon={Save} size="lg" label={guardando ? 'Guardando…' : 'Guardar intervención'} onPress={pedirConfirmacion} disabled={guardando} />

      <Modal visible={confirmar} onClose={() => setConfirmar(false)} title="¿Guardar intervención?" closeLabel="Cancelar">
        <ModalText>¿Está seguro que desea guardar esta intervención?</ModalText>
        <View style={s.resumen}>
          {resumen.map(([k, v]) => (
            <View key={k} style={s.resumenFila}>
              <Text size={11} color={colors.mutedForeground} style={{ width: 92 }}>
                {k}
              </Text>
              <Text size={12} weight="semibold" style={{ flex: 1 }}>
                {v || '—'}
              </Text>
            </View>
          ))}
        </View>
        <ModalActions>
          <Button variant="outline" label="Cancelar" onPress={() => setConfirmar(false)} />
          <Button icon={Save} label="Guardar" onPress={() => void guardar()} />
        </ModalActions>
      </Modal>
    </>
  );
}

/* ------------------------------- Componentes ------------------------------ */

function UbicacionBanner({ ubicacion, requerida, error, onReintentar }: { ubicacion: ReturnType<typeof useUbicacion>['ubicacion']; requerida: boolean; error?: string; onReintentar: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const lista = ubicacion.estado === 'lista';
  // La ubicación se obtiene en segundo plano: el aviso solo aparece si hay un problema
  // que el usuario tiene que resolver (sin permiso / sin GPS) o al intentar guardar sin ella.
  const hayProblema = requerida && (ubicacion.estado === 'sin-permiso' || ubicacion.estado === 'error');
  if (!hayProblema && !error) return null;
  const texto =
    ubicacion.estado === 'buscando'
      ? 'Obteniendo tu ubicación…'
      : ubicacion.estado === 'lista'
        ? `Ubicación obtenida${ubicacion.precision ? ` (±${Math.round(ubicacion.precision)} m)` : ''}`
        : ubicacion.estado === 'sin-permiso'
          ? 'Permití el acceso a la ubicación para marcar.'
          : 'No se pudo obtener la ubicación. Revisá que el GPS esté encendido.';
  const color = lista ? colors.success : requerida && ubicacion.estado !== 'buscando' ? colors.destructive : colors.mutedForeground;
  return (
    <View style={[s.banner, { borderColor: error ? colors.destructive : colors.border }]}>
      {ubicacion.estado === 'buscando' ? <ActivityIndicator size="small" color={colors.mutedForeground} /> : <MapPin size={16} color={color} />}
      <View style={{ flex: 1 }}>
        <Text size={12} color={color}>
          {requerida || lista ? texto : 'Tu ubicación no es obligatoria para marcar.'}
        </Text>
        {error ? (
          <Text accessibilityRole="alert" size={11} weight="semibold" color={colors.destructive} style={{ marginTop: 4 }}>
            {error}
          </Text>
        ) : null}
      </View>
      {!lista && ubicacion.estado !== 'buscando' && <Button size="sm" variant="ghost" icon={RefreshCw} label="Reintentar" onPress={onReintentar} />}
    </View>
  );
}

function Paso({ n, titulo, icon: Icon, cargando, children }: { n: number; titulo: string; icon: LucideIcon; cargando?: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Card style={s.paso}>
      <View style={s.pasoHead}>
        <View style={s.pasoNro}>
          <Text weight="bold" size={12} color={colors.primaryForeground}>
            {n}
          </Text>
        </View>
        <Icon size={16} color={colors.primaryText} />
        <Text weight="bold" size={15} style={{ flex: 1 }}>
          {titulo}
        </Text>
        {cargando && <ActivityIndicator size="small" color={colors.primaryText} />}
      </View>
      {children}
    </Card>
  );
}

function Campo({ etiqueta, requerido, error, cargando, children }: { etiqueta?: string; requerido?: boolean; error?: string; cargando?: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      {etiqueta && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Text weight="semibold" size={12}>
            {etiqueta}
            {requerido ? <Text color={colors.destructive}> *</Text> : null}
          </Text>
          {cargando && <ActivityIndicator size="small" color={colors.mutedForeground} />}
        </View>
      )}
      {children}
      {error && (
        <Text accessibilityRole="alert" size={11} color={colors.destructive} style={{ marginTop: 6 }}>
          {error}
        </Text>
      )}
    </View>
  );
}

type Valor = string | number | null;

function Chips({ opciones, valor, onCambiar, vacio, icono: Icono, colorDe }: { opciones: Opcion[]; valor: Valor; onCambiar: (v: Valor) => void; vacio?: string; icono?: LucideIcon; colorDe?: (v: Valor) => string }) {
  const { colors } = useTheme();
  const s = useStyles();
  if (!opciones.length) {
    return (
      <Text size={12} color={colors.mutedForeground}>
        {vacio ?? 'Sin opciones'}
      </Text>
    );
  }
  return (
    <View style={s.chips}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        const tinta = colorDe?.(o.valor);
        return (
          <Pressable
            key={String(o.valor)}
            accessibilityRole="radio"
            accessibilityLabel={o.etiqueta}
            accessibilityState={{ checked: activo }}
            onPress={() => onCambiar(o.valor)}
            style={({ pressed }) => [s.chip, activo && s.chipActivo, tinta ? { borderColor: tinta } : null, pressed && { opacity: 0.8 }]}
          >
            {tinta ? <View style={[s.chipPunto, { backgroundColor: tinta }]} /> : Icono ? <Icono size={13} color={activo ? colors.primaryForeground : colors.mutedForeground} /> : null}
            <Text size={13} weight={activo ? 'bold' : 'medium'} color={activo ? colors.primaryForeground : colors.foreground}>
              {o.etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Lista con buscador en un panel (equivale al popup LOV de APEX). */
function Selector({ titulo, placeholder, opciones, valor, onCambiar, buscador, colorBorde }: { titulo: string; placeholder: string; opciones: Opcion[]; valor: Valor; onCambiar: (v: Valor) => void; buscador?: boolean; colorBorde?: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  const [abierto, setAbierto] = useState(false);
  const actual = opciones.find((o) => o.valor === valor);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${titulo}: ${actual?.etiqueta ?? placeholder}`}
        disabled={!opciones.length}
        onPress={() => setAbierto(true)}
        style={[s.selector, colorBorde ? { borderColor: colorBorde, borderLeftWidth: 4 } : null, !opciones.length && { opacity: 0.6 }]}
      >
        <Text size={14} color={actual ? colors.foreground : colors.mutedForeground} style={{ flex: 1 }} numberOfLines={2}>
          {actual?.etiqueta ?? placeholder}
        </Text>
        <ChevronDown size={18} color={colors.mutedForeground} />
      </Pressable>
      <HojaOpciones visible={abierto} titulo={titulo} opciones={opciones} valor={valor} buscador={buscador} onCerrar={() => setAbierto(false)} onElegir={onCambiar} />
    </>
  );
}

/**
 * Casilla de la ficha "Clase": etiqueta chica y valor. Con una sola opción el valor queda fijo;
 * con varias, tocarla abre la lista para elegir.
 */
function Casilla({ etiqueta, requerido, opciones, valor, onCambiar, error }: { etiqueta: string; requerido?: boolean; opciones: Opcion[]; valor: Valor; onCambiar: (v: Valor) => void; error?: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  const [abierto, setAbierto] = useState(false);
  const actual = opciones.find((o) => o.valor === valor);
  const elegible = opciones.length > 1;
  const texto = actual?.etiqueta || (elegible ? 'Elegir' : '—');
  return (
    <>
      <Pressable
        accessibilityRole={elegible ? 'button' : undefined}
        accessibilityLabel={`${etiqueta}: ${actual?.etiqueta || 'sin dato'}${elegible ? '. Tocá para cambiar' : ''}`}
        disabled={!elegible}
        onPress={() => setAbierto(true)}
        style={({ pressed }) => [s.casilla, elegible && s.casillaElegible, error ? { borderColor: colors.destructive } : null, pressed && { opacity: 0.8 }]}
      >
        <Text size={10} weight="bold" color={colors.mutedForeground} numberOfLines={1} style={{ letterSpacing: 0.5 }}>
          {etiqueta.toUpperCase()}
          {requerido ? <Text size={10} color={colors.destructive}> *</Text> : null}
        </Text>
        <View style={s.casillaValor}>
          <Text size={14} weight="bold" color={actual?.etiqueta ? colors.foreground : colors.mutedForeground} numberOfLines={2} style={{ flexShrink: 1 }}>
            {texto}
          </Text>
          {elegible && <ChevronDown size={14} color={colors.primaryText} />}
        </View>
      </Pressable>
      {elegible && <HojaOpciones visible={abierto} titulo={etiqueta} opciones={opciones} valor={valor} onCerrar={() => setAbierto(false)} onElegir={onCambiar} />}
    </>
  );
}

/** Panel inferior con la lista de opciones (y buscador si son muchas). */
function HojaOpciones({ visible, titulo, opciones, valor, buscador, onCerrar, onElegir }: { visible: boolean; titulo: string; opciones: Opcion[]; valor: Valor; buscador?: boolean; onCerrar: () => void; onElegir: (v: Valor) => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const [filtro, setFiltro] = useState('');
  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const visibles = filtro ? opciones.filter((o) => norm(o.etiqueta).includes(norm(filtro))) : opciones;
  const cerrar = () => {
    setFiltro('');
    onCerrar();
  };
  return (
      <RNModal visible={visible} transparent animationType="slide" onRequestClose={cerrar}>
        <View style={s.hojaFondo}>
          <Pressable style={StyleSheet.absoluteFill} onPress={cerrar} accessibilityLabel="Cerrar lista" />
          <View style={[s.hoja, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
            <View style={s.hojaHead}>
              <Text weight="bold" size={16} style={{ flex: 1 }}>
                {titulo}
              </Text>
              <Button variant="ghost" size="icon" icon={X} accessibilityLabel="Cerrar lista" onPress={cerrar} />
            </View>
            {buscador && opciones.length > 6 && (
              <View style={s.buscador}>
                <Search size={16} color={colors.mutedForeground} />
                <TextInput value={filtro} onChangeText={setFiltro} placeholder="Buscar…" placeholderTextColor={colors.mutedForeground} style={s.buscadorInput} autoFocus accessibilityLabel={`Buscar ${titulo.toLowerCase()}`} />
              </View>
            )}
            <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
              {visibles.map((o) => {
                const activo = o.valor === valor;
                return (
                  <Pressable
                    key={String(o.valor)}
                    accessibilityRole="button"
                    accessibilityLabel={o.etiqueta}
                    onPress={() => {
                      cerrar();
                      onElegir(o.valor);
                    }}
                    style={({ pressed }) => [s.opcion, activo && s.opcionActiva, pressed && { backgroundColor: colors.muted }]}
                  >
                    <Text weight={activo ? 'bold' : 'regular'} color={activo ? colors.primaryText : colors.foreground} style={{ flex: 1 }}>
                      {o.etiqueta}
                    </Text>
                    {activo && <Check size={16} color={colors.primaryText} />}
                  </Pressable>
                );
              })}
              {!visibles.length && (
                <Text color={colors.mutedForeground} style={{ padding: 16 }}>
                  Sin resultados.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </RNModal>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    centro: { paddingVertical: 56, alignItems: 'center', gap: 12 },
    banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg, borderWidth: 1, backgroundColor: c.card, marginBottom: 14 },
    paso: { marginBottom: 14 },
    pasoHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    pasoNro: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    ficha: { flexDirection: 'row', gap: 8 },
    casilla: { flex: 1, minWidth: 0, gap: 4, paddingVertical: 10, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.muted },
    casillaElegible: { backgroundColor: c.card, borderColor: c.primary },
    casillaValor: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: c.border, backgroundColor: c.background },
    chipActivo: { backgroundColor: c.primary, borderColor: c.primary },
    chipPunto: { width: 10, height: 10, borderRadius: 5 },
    selector: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
    segmento: { flexDirection: 'row', gap: 8 },
    segmentoOp: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.background },
    segmentoSi: { backgroundColor: c.successSoft, borderColor: c.success, borderWidth: 2 },
    segmentoNo: { backgroundColor: c.muted, borderColor: c.destructive, borderWidth: 2 },
    textarea: { minHeight: 110, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: 12, color: c.foreground, backgroundColor: c.card, textAlignVertical: 'top', fontSize: 16 },
    resumen: { marginTop: 12, gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: c.muted },
    resumenFila: { flexDirection: 'row', gap: 8 },
    hojaFondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay },
    hoja: { backgroundColor: c.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 12, maxHeight: '80%' },
    hojaHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    buscador: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: 10, marginBottom: 8 },
    buscadorInput: { flex: 1, minHeight: 42, color: c.foreground, fontSize: 16 },
    opcion: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 12, borderRadius: radius.md },
    opcionActiva: { backgroundColor: c.secondary },
  }),
);

