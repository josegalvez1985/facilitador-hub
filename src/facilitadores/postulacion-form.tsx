// Formulario por pasos de "Mi postulación". Un paso por pantalla, con barra de progreso, opciones en
// botones (no listas desplegables), lo condicional solo cuando corresponde y una revisión final con
// "Editar" por sección. Valida el paso al tocar Siguiente; el servidor vuelve a validar todo.
// Va dentro de la pantalla (no en un modal): el shell trae el KeyboardAvoidingView de Android.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Image } from 'expo-image';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  Camera,
  Check,
  ChevronDown,
  Church,
  ClipboardList,
  CircleCheck,
  CircleX,
  ExternalLink,
  FileText,
  FileUp,
  GraduationCap,
  Handshake,
  ImagePlus,
  LocateFixed,
  MapPinHouse,
  Pencil,
  Save,
  Search,
  Send,
  Trash2,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';

import type { ArchivoLocal } from './cloudinary';
import { esPdf, miniatura } from './facturas';
import { MESES } from './fechas';
import { ErrorDeCampo } from './intervenciones';
import {
  campoNivel,
  cargarLugares,
  DIAS,
  dmaAIso,
  documentosRequeridos,
  EDAD_MAXIMA,
  EDAD_MINIMA,
  edadDe,
  enlaceMapa,
  enviarPostulacion,
  ESTADO_CIVIL,
  etiquetaDe,
  FACTURA_TIPO,
  fotoDeDocumento,
  isoADma,
  LARGO_AREAS,
  mascaraFecha,
  NIVELES,
  PASOS,
  pasoDeCampo,
  pdfDeDocumento,
  pideTitulo,
  faltantes,
  guardarSinTerminar,
  primerPasoConErrores,
  quitarDocumento,
  SI_NO,
  soloCedula,
  subirDocumento,
  TALLES,
  TIPO_VEHICULO,
  TIPOS_CUENTA,
  TURNOS,
  ubicacionActual,
  VIVE_CON,
  type CampoTexto,
  type Datos,
  type Departamento,
  type Documento,
  type Errores,
  type Lugar,
  type Opcion,
  type PasoId,
} from './postulacion';
import { useLayout, useSubirAlInicio } from './shell';
import { radius } from './theme';
import { makeStyles, useTheme } from './theme-provider';
import { useToast } from './toast';
import { Button, Card, Modal, Text } from './ui';

const ICONO_PASO: Record<PasoId, LucideIcon> = {
  proceso: Handshake,
  personales: UserRound,
  domicilio: MapPinHouse,
  estudios: GraduationCap,
  trabajo: BriefcaseBusiness,
  disponibilidad: CalendarClock,
  iglesia: Church,
  cobro: Banknote,
  documentos: FileUp,
  revisar: Send,
};

type Props = {
  anio: string;
  /** Si ya es facilitador (se postula para seguir) o es un postulante nuevo. */
  esFacilitador: boolean;
  /** Etapas y requisitos del proceso del año (ANIOS_LECTIVOS.PROCESO_POSTULACION), en texto. */
  proceso: string;
  datosIniciales: Datos;
  pasoInicial: number;
  /** Ya la había enviado: el botón final dice "Guardar cambios". */
  esCorreccion: boolean;
  /** Cada cambio (para conservar lo cargado si sale de la pantalla). */
  onCambio: (datos: Datos, paso: number) => void;
  onSalir: () => void;
  onEnviada: () => void;
  /** Guardada sin terminar desde el último paso: vuelve a la pantalla. */
  onGuardada: () => void;
};

export function FormularioPostulacion({ anio, esFacilitador, proceso, datosIniciales, pasoInicial, esCorreccion, onCambio, onSalir, onEnviada, onGuardada }: Props) {
  const { colors } = useTheme();
  const s = useStyles();
  const toast = useToast();
  const subir = useSubirAlInicio();
  const [d, setD] = useState<Datos>(datosIniciales);
  const [paso, setPaso] = useState(pasoInicial);
  // El paso más lejano al que llegó: se puede saltar a cualquiera hasta ahí desde la barra.
  const [alcanzado, setAlcanzado] = useState(pasoInicial);
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);

  const actual = PASOS[paso] ?? PASOS[0]!;
  const ultimo = paso === PASOS.length - 1;

  useEffect(() => {
    onCambio(d, paso);
  }, [d, paso, onCambio]);

  const set = <K extends keyof Datos>(campo: K, valor: Datos[K]) => {
    setD((x) => ({ ...x, [campo]: valor }));
    setErrores((e) => (e[campo] || e.general ? { ...e, [campo]: undefined, general: undefined } : e));
  };

  const ir = (i: number) => {
    setPaso(i);
    setAlcanzado((a) => Math.max(a, i));
    setErrores({});
    subir();
  };

  // Ningún campo es obligatorio para avanzar ni para guardar: lo que falta se ve en el último paso
  // (y en el aviso de Inicio). Para ENVIAR tiene que estar todo.
  const siguiente = () => ir(paso + 1);
  const falta = faltantes(d);
  const completa = falta.pasos.length === 0 && falta.archivos.length === 0;
  // Sin acuerdo con el proceso no se sigue ni se guarda nada.
  const noDeAcuerdo = d.acepta_proceso !== 'DE_ACUERDO';

  const guardar = async (salir: boolean) => {
    setEnviando(true);
    setErrores({});
    try {
      await guardarSinTerminar(d, paso);
      toast.success(salir ? 'Guardada. Podés terminarla cuando quieras.' : 'Guardada');
      if (salir) onGuardada();
    } catch (err) {
      setErrores({ general: err instanceof Error ? err.message : 'No se pudo guardar.' });
    } finally {
      setEnviando(false);
    }
  };

  const enviar = async () => {
    const mal = primerPasoConErrores(d);
    if (mal) {
      ir(mal.paso);
      setErrores({ ...mal.errores, general: 'Falta completar o corregir algo en este paso.' });
      return;
    }
    setEnviando(true);
    try {
      const r = await enviarPostulacion(d);
      toast.success(r.nueva ? '¡Postulación enviada!' : 'Postulación actualizada');
      onEnviada();
    } catch (err) {
      if (err instanceof ErrorDeCampo && err.campo) {
        const i = pasoDeCampo(err.campo);
        ir(i);
        setErrores({ [err.campo]: err.message, general: err.message });
      } else setErrores({ general: err instanceof Error ? err.message : 'No se pudo enviar la postulación.' });
    } finally {
      setEnviando(false);
    }
  };

  const ctx: CtxPaso = { d, set, errores, disabled: enviando };
  // Celular: el botón principal ocupa lo que deja "Atrás", y si no entra (por ejemplo
  // "Guardar y terminar después" en 360 px) baja a su propio renglón con todo el ancho.
  const { desktop } = useLayout();
  const principal = desktop ? undefined : s.principalCelular;

  return (
    <View style={{ gap: 16, maxWidth: 720, width: '100%' }}>
      {/* Encabezado */}
      <View style={s.encabezado}>
        <Button variant="ghost" size="icon" icon={ArrowLeft} accessibilityLabel="Salir del formulario" onPress={onSalir} disabled={enviando} />
        <View style={{ flex: 1 }}>
          <Text size={12} weight="semibold" color={colors.primaryText}>
            POSTULACIÓN {anio}
          </Text>
          <Text weight="bold" size={22} accessibilityRole="header">
            {actual.titulo}
          </Text>
          <Text size={12} color={colors.mutedForeground}>
            Paso {paso + 1} de {PASOS.length}
          </Text>
        </View>
        <Button variant="outline" size="sm" icon={Save} label="Guardar" onPress={() => void guardar(false)} disabled={enviando || noDeAcuerdo} accessibilityLabel="Guardar sin terminar" />
      </View>

      <BarraPasos paso={paso} alcanzado={alcanzado} onIr={ir} disabled={enviando} />

      {actual.id === 'proceso' && <PasoProceso anio={anio} esFacilitador={esFacilitador} proceso={proceso} {...ctx} />}
      {actual.id === 'personales' && <PasoPersonales {...ctx} />}
      {actual.id === 'domicilio' && <PasoDomicilio {...ctx} />}
      {actual.id === 'estudios' && <PasoEstudios {...ctx} />}
      {actual.id === 'trabajo' && <PasoTrabajo {...ctx} />}
      {actual.id === 'disponibilidad' && <PasoDisponibilidad {...ctx} />}
      {actual.id === 'iglesia' && <PasoIglesia {...ctx} />}
      {actual.id === 'cobro' && <PasoCobro {...ctx} />}
      {actual.id === 'documentos' && <PasoDocumentos {...ctx} />}
      {actual.id === 'revisar' && !completa && <Faltan falta={falta} onIr={enviando ? undefined : ir} />}
      {actual.id === 'revisar' && <Resumen datos={d} onEditar={enviando ? undefined : ir} />}

      {ultimo && (
        <Text size={12} color={colors.mutedForeground} style={{ lineHeight: 18 }}>
          {completa ? 'Después de enviarla vas a poder corregirla desde esta misma sección.' : 'Podés guardarla así y terminarla cuando quieras. Para enviarla tiene que estar todo completo.'}
        </Text>
      )}

      {errores.general && (
        <View style={s.alerta}>
          <CircleX size={16} color={colors.destructive} />
          <Text accessibilityRole="alert" size={13} color={colors.destructive} style={{ flex: 1 }}>
            {errores.general}
          </Text>
        </View>
      )}

      {/* Navegación */}
      <View style={s.navegacion}>
        {paso > 0 ? <Button variant="outline" icon={ArrowLeft} label="Atrás" onPress={() => ir(paso - 1)} disabled={enviando} /> : <View />}
        {ultimo ? (
          completa ? (
            <Button size="lg" icon={Send} label={enviando ? 'Enviando…' : esCorreccion ? 'Guardar cambios' : 'Enviar postulación'} onPress={() => void enviar()} disabled={enviando} style={principal} />
          ) : (
            <Button size="lg" icon={Save} label={enviando ? 'Guardando…' : 'Guardar y terminar después'} onPress={() => void guardar(true)} disabled={enviando || noDeAcuerdo} style={principal} />
          )
        ) : (
          <Button size="lg" iconRight={ArrowRight} label="Siguiente" onPress={siguiente} disabled={enviando || (actual.id === 'proceso' && noDeAcuerdo)} style={principal} />
        )}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------------- */
/* Lo que falta (último paso)                                                */
/* ------------------------------------------------------------------------- */

function Faltan({ falta, onIr }: { falta: ReturnType<typeof faltantes>; onIr?: (paso: number) => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const iDocs = PASOS.findIndex((p) => p.id === 'documentos');
  return (
    <Card style={{ gap: 10, borderColor: colors.accent, backgroundColor: colors.accentSoft }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TriangleAlert size={18} color={colors.accent} />
        <Text weight="bold" size={14} style={{ flex: 1 }}>
          Te falta completar
        </Text>
      </View>
      {falta.pasos.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text size={12} weight="semibold" color={colors.mutedForeground}>
            DATOS
          </Text>
          <View style={s.opciones}>
            {falta.pasos.map((p) => (
              <Button key={p.paso} size="sm" variant="outline" label={p.titulo} onPress={onIr ? () => onIr(p.paso) : () => {}} disabled={!onIr} accessibilityLabel={`Completar ${p.titulo.toLowerCase()}`} />
            ))}
          </View>
        </View>
      )}
      {falta.archivos.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text size={12} weight="semibold" color={colors.mutedForeground}>
            ARCHIVOS
          </Text>
          <Text size={13} style={{ lineHeight: 19 }}>
            {falta.archivos.join(' · ')}
          </Text>
          <Button size="sm" variant="outline" icon={FileUp} label="Subir archivos" onPress={onIr ? () => onIr(iDocs) : () => {}} disabled={!onIr} style={{ alignSelf: 'flex-start' }} />
        </View>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------- */
/* Barra de pasos                                                            */
/* ------------------------------------------------------------------------- */

function BarraPasos({ paso, alcanzado, onIr, disabled }: { paso: number; alcanzado: number; onIr: (i: number) => void; disabled: boolean }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View>
      <View style={s.barra} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: PASOS.length, now: paso + 1 }}>
        <View style={[s.barraRelleno, { width: `${((paso + 1) / PASOS.length) * 100}%` }]} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={{ marginTop: 10 }}>
        {PASOS.map((p, i) => {
          const Icono = ICONO_PASO[p.id];
          const activo = i === paso;
          const hecho = i < paso || (i <= alcanzado && !activo);
          const puede = i <= alcanzado && !disabled && !activo;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`Paso ${i + 1}: ${p.titulo}${activo ? ', actual' : ''}`}
              accessibilityState={{ selected: activo, disabled: !puede && !activo }}
              disabled={!puede}
              onPress={() => onIr(i)}
              style={[s.chip, activo && { backgroundColor: colors.primary, borderColor: colors.primary }, !activo && i > alcanzado && { opacity: 0.5 }]}
            >
              {hecho ? <Check size={13} color={colors.success} /> : <Icono size={13} color={activo ? colors.primaryForeground : colors.mutedForeground} />}
              <Text size={11} weight={activo ? 'bold' : 'medium'} color={activo ? colors.primaryForeground : colors.foreground}>
                {p.titulo}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------------- */
/* Controles                                                                 */
/* ------------------------------------------------------------------------- */

type CtxPaso = {
  d: Datos;
  set: <K extends keyof Datos>(campo: K, valor: Datos[K]) => void;
  errores: Errores;
  disabled: boolean;
};

// Sin asterisco (24/11/2026): nada es obligatorio para GUARDAR. Lo que no hace falta ni para
// enviar lleva "(opcional)"; lo que falta para enviar se lista en el último paso y en Inicio.
function Pregunta({ etiqueta, requerido = true, ayuda, error, children }: { etiqueta: string; requerido?: boolean; ayuda?: string; error?: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text weight="semibold" size={13}>
        {etiqueta}
        {requerido ? null : <Text size={12} color={colors.mutedForeground}> (opcional)</Text>}
      </Text>
      {children}
      {ayuda && !error ? (
        <Text size={11} color={colors.mutedForeground} style={{ lineHeight: 16 }}>
          {ayuda}
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" size={12} color={colors.destructive}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

type EntradaProps = Omit<TextInputProps, 'value' | 'onChangeText'> & { valor: string; onCambiar: (v: string) => void; error?: boolean; disabled?: boolean };

function Entrada({ valor, onCambiar, error, disabled, style, multiline, ...props }: EntradaProps) {
  const { colors } = useTheme();
  const s = useStyles();
  const [foco, setFoco] = useState(false);
  return (
    <TextInput
      value={valor}
      onChangeText={onCambiar}
      editable={!disabled}
      multiline={multiline}
      placeholderTextColor={colors.mutedForeground}
      keyboardAppearance={colors.scheme}
      onFocus={() => setFoco(true)}
      onBlur={() => setFoco(false)}
      style={[s.input, multiline && { minHeight: 110, paddingTop: 12, textAlignVertical: 'top' }, foco && { borderColor: colors.primary }, error && { borderColor: colors.destructive }, style]}
      {...props}
    />
  );
}

/** Un campo de texto con su pregunta. */
function CampoEscrito({ ctx, campo, etiqueta, requerido, ayuda, ...props }: { ctx: CtxPaso; campo: CampoTexto; etiqueta: string; requerido?: boolean; ayuda?: string } & Omit<EntradaProps, 'valor' | 'onCambiar'>) {
  return (
    <Pregunta etiqueta={etiqueta} requerido={requerido} ayuda={ayuda} error={ctx.errores[campo]}>
      <Entrada valor={ctx.d[campo]} onCambiar={(v) => ctx.set(campo, v)} error={!!ctx.errores[campo]} disabled={ctx.disabled} accessibilityLabel={etiqueta} {...props} />
    </Pregunta>
  );
}

/** Opciones como botones (una sola). */
function Opciones({ opciones, valor, onCambiar, error, disabled, etiqueta }: { opciones: Opcion[]; valor: string; onCambiar: (v: string) => void; error?: boolean; disabled?: boolean; etiqueta: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.opciones} accessibilityRole="radiogroup" accessibilityLabel={etiqueta}>
      {opciones.map((o) => {
        const sel = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            accessibilityRole="radio"
            accessibilityState={{ checked: sel, disabled }}
            accessibilityLabel={o.label}
            disabled={disabled}
            onPress={() => onCambiar(o.valor)}
            style={({ pressed }) => [s.opcion, sel && { backgroundColor: colors.secondary, borderColor: colors.primary }, error && !sel && { borderColor: colors.destructive }, pressed && { opacity: 0.75 }]}
          >
            {sel && <Check size={14} color={colors.primaryText} />}
            <Text size={13} weight={sel ? 'semibold' : 'medium'} color={sel ? colors.primaryText : colors.foreground}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CampoOpciones({ ctx, campo, etiqueta, opciones, requerido, ayuda }: { ctx: CtxPaso; campo: CampoTexto; etiqueta: string; opciones: Opcion[]; requerido?: boolean; ayuda?: string }) {
  return (
    <Pregunta etiqueta={etiqueta} requerido={requerido} ayuda={ayuda} error={ctx.errores[campo]}>
      <Opciones etiqueta={etiqueta} opciones={opciones} valor={ctx.d[campo]} onCambiar={(v) => ctx.set(campo, v)} error={!!ctx.errores[campo]} disabled={ctx.disabled} />
    </Pregunta>
  );
}

/** Una tarjeta-sección dentro de un paso. */
function Seccion({ titulo, icono: Icono, children }: { titulo?: string; icono?: LucideIcon; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: 20 }}>
      {titulo ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {Icono && <Icono size={18} color={colors.primaryText} />}
          <Text weight="bold" size={15}>
            {titulo}
          </Text>
        </View>
      ) : null}
      {children}
    </Card>
  );
}

/** Dos campos lado a lado cuando hay lugar. */
function Fila({ children }: { children: ReactNode }) {
  const s = useStyles();
  return <View style={s.fila}>{children}</View>;
}
function Col({ children }: { children: ReactNode }) {
  return <View style={{ flexGrow: 1, flexBasis: 240 }}>{children}</View>;
}

/* ------------------------------------------------------------------------- */
/* Pasos                                                                     */
/* ------------------------------------------------------------------------- */

function PasoProceso({ anio, esFacilitador, proceso, d, set, errores, disabled }: CtxPaso & { anio: string; esFacilitador: boolean; proceso: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  const opciones = [
    { valor: 'DE_ACUERDO', titulo: 'Estoy de acuerdo', detalle: 'Quiero postularme para el año lectivo ' + anio + '.', icono: CircleCheck },
    { valor: 'NO_DE_ACUERDO', titulo: 'No estoy de acuerdo', detalle: 'Por ahora no voy a postularme.', icono: CircleX },
  ];
  return (
    <>
      <Seccion>
        <Text size={14} style={{ lineHeight: 22 }}>
          {esFacilitador ? (
            <>
              Con esta postulación le contás a la fundación que querés seguir como facilitador en <Text weight="bold">{anio}</Text>, y actualizás tus datos.
            </>
          ) : (
            <>
              Con esta postulación le contás a la fundación que querés ser facilitador en <Text weight="bold">{anio}</Text>.
            </>
          )}
        </Text>
        <View style={{ gap: 10 }}>
          {[
            `Son ${PASOS.length - 1} pasos cortos. Podés ir y volver entre ellos.`,
            'Tené a mano tu cédula, los datos de tu iglesia y los de tu cuenta bancaria.',
            'Al final vas a subir, en foto o PDF: una foto carnet, tu cédula, tu CV, los certificados de no agresor y de antecedentes judiciales y policiales, y tus títulos.',
            'Podés guardarla sin terminar y seguir otro día. Una vez enviada, la podés corregir durante el año.',
          ].map((t) => (
            <View key={t} style={{ flexDirection: 'row', gap: 10 }}>
              <Check size={16} color={colors.success} style={{ marginTop: 2 }} />
              <Text size={13} color={colors.mutedForeground} style={{ flex: 1, lineHeight: 20 }}>
                {t}
              </Text>
            </View>
          ))}
        </View>
      </Seccion>

      {/* Etapas y requisitos del año: ANIOS_LECTIVOS.PROCESO_POSTULACION. */}
      <Seccion titulo={`El proceso de postulación ${anio}`} icono={ClipboardList}>
        {proceso ? (
          <View style={{ gap: 8 }}>
            {proceso.split(/\n{2,}/).map((parrafo, i) => (
              <Text key={i} size={14} style={{ lineHeight: 22 }}>
                {parrafo}
              </Text>
            ))}
          </View>
        ) : (
          <Text size={13} color={colors.mutedForeground} style={{ lineHeight: 20 }}>
            La coordinación todavía no cargó las etapas y los requisitos de este año. Si tenés dudas, consultá con ella antes de seguir.
          </Text>
        )}
      </Seccion>

      <Text weight="semibold" size={13}>
        ¿Leíste las etapas y los requisitos del proceso y estás de acuerdo?
      </Text>
      <View style={s.tarjetasOpcion} accessibilityRole="radiogroup">
        {opciones.map((o) => {
          const sel = d.acepta_proceso === o.valor;
          return (
            <Pressable
              key={o.valor}
              accessibilityRole="radio"
              accessibilityState={{ checked: sel }}
              disabled={disabled}
              onPress={() => set('acepta_proceso', o.valor)}
              style={({ pressed }) => [s.tarjetaOpcion, sel && { borderColor: colors.primary, backgroundColor: colors.secondary }, pressed && { opacity: 0.8 }]}
            >
              <o.icono size={22} color={sel ? colors.primaryText : colors.mutedForeground} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text weight="bold" size={15} color={sel ? colors.primaryText : colors.foreground}>
                  {o.titulo}
                </Text>
                <Text size={12} color={colors.mutedForeground}>
                  {o.detalle}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {d.acepta_proceso === 'NO_DE_ACUERDO' ? (
        <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }}>
          <Text size={13} style={{ lineHeight: 20 }}>
            Sin tu acuerdo no podemos registrar la postulación, así que no se envía nada. Si tenés dudas sobre el proceso, consultá con la coordinación.
          </Text>
        </Card>
      ) : errores.acepta_proceso ? (
        <Text accessibilityRole="alert" size={12} color={colors.destructive}>
          {errores.acepta_proceso}
        </Text>
      ) : null}
    </>
  );
}

function PasoPersonales(ctx: CtxPaso) {
  const { d, set, errores, disabled } = ctx;
  const { colors } = useTheme();
  const edad = edadDe(d.fecha_nacimiento);
  return (
    <>
      <Seccion titulo="Quién sos" icono={UserRound}>
        <CampoEscrito ctx={ctx} campo="nombre_completo" etiqueta="Nombre completo" ayuda="Tal como figura en tu cédula." autoCapitalize="words" maxLength={200} />
        <Fila>
          <Col>
            <CampoEscrito ctx={ctx} campo="cedula" etiqueta="Número de cédula" placeholder="1234567" keyboardType="number-pad" maxLength={20} onBlur={() => set('cedula', soloCedula(d.cedula))} />
          </Col>
          <Col>
            <Pregunta etiqueta="Fecha de nacimiento" error={errores.fecha_nacimiento} ayuda={edad !== null && edad >= EDAD_MINIMA && edad <= EDAD_MAXIMA ? `Tenés ${edad} años.` : 'Día, mes y año.'}>
              <CampoFecha valor={d.fecha_nacimiento} onCambiar={(v) => set('fecha_nacimiento', v)} error={!!errores.fecha_nacimiento} disabled={disabled} />
            </Pregunta>
          </Col>
        </Fila>
        <CampoEscrito ctx={ctx} campo="nacionalidad" etiqueta="Nacionalidad" autoCapitalize="words" maxLength={100} />
      </Seccion>

      <Seccion titulo="Contacto">
        <Fila>
          <Col>
            <CampoEscrito ctx={ctx} campo="telefono" etiqueta="Teléfono" placeholder="0981 123456" keyboardType="phone-pad" maxLength={30} />
          </Col>
          <Col>
            <CampoEscrito ctx={ctx} campo="correo_electronico" etiqueta="Correo electrónico" placeholder="nombre@gmail.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={200} />
          </Col>
        </Fila>
      </Seccion>

      <Seccion titulo="Tu familia">
        <CampoOpciones ctx={ctx} campo="estado_civil" etiqueta="Estado civil" opciones={ESTADO_CIVIL} />
        {d.estado_civil === 'OTROS' && <CampoEscrito ctx={ctx} campo="estado_civil_otro" etiqueta="¿Cuál?" placeholder="Por ejemplo: en pareja, viudo/a" maxLength={100} />}
        <CampoOpciones ctx={ctx} campo="vive_con" etiqueta="¿Con quién vivís?" opciones={VIVE_CON} />
        <CampoOpciones ctx={ctx} campo="hijos" etiqueta="¿Tenés hijos?" opciones={SI_NO} />
        <CampoOpciones ctx={ctx} campo="talle_remera" etiqueta="Talle de remera" opciones={TALLES} requerido={false} />
        {d.talle_remera ? (
          <Pressable accessibilityRole="button" onPress={() => set('talle_remera', '')} disabled={disabled}>
            <Text size={12} color={colors.primaryText}>
              Quitar el talle
            </Text>
          </Pressable>
        ) : null}
      </Seccion>
    </>
  );
}

/** Fecha que se escribe DD/MM/AAAA (para la de nacimiento, más cómodo que un calendario). */
function CampoFecha({ valor, onCambiar, error, disabled }: { valor: string; onCambiar: (iso: string) => void; error?: boolean; disabled?: boolean }) {
  const [texto, setTexto] = useState(isoADma(valor));
  return (
    <Entrada
      valor={texto}
      onCambiar={(t) => {
        const m = mascaraFecha(t);
        setTexto(m);
        onCambiar(dmaAIso(m));
      }}
      placeholder="DD/MM/AAAA"
      keyboardType="number-pad"
      maxLength={10}
      error={error}
      disabled={disabled}
      accessibilityLabel="Fecha de nacimiento, día, mes y año"
    />
  );
}

function PasoDomicilio(ctx: CtxPaso) {
  const { d, set, errores, disabled } = ctx;
  const { colors } = useTheme();
  const s = useStyles();
  const [lugares, setLugares] = useState<Departamento[] | null>(null);
  const [errorLugares, setErrorLugares] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [errorGps, setErrorGps] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    cargarLugares()
      .then((l) => vigente && setLugares(l))
      .catch((e: unknown) => vigente && setErrorLugares(e instanceof Error ? e.message : 'No se pudieron cargar los departamentos.'));
    return () => {
      vigente = false;
    };
  }, [intento]);

  const depto = lugares?.find((x) => x.id === d.id_departamento) ?? null;
  const mapa = enlaceMapa(d.ubicacion_domicilio);

  const usarGps = async () => {
    setBuscandoGps(true);
    setErrorGps(null);
    try {
      set('ubicacion_domicilio', await ubicacionActual());
    } catch (e) {
      setErrorGps(e instanceof Error ? e.message : 'No se pudo obtener la ubicación.');
    } finally {
      setBuscandoGps(false);
    }
  };

  return (
    <>
      <Seccion titulo="Dónde vivís" icono={MapPinHouse}>
        {errorLugares ? (
          <View style={{ gap: 10 }}>
            <Text accessibilityRole="alert" size={13} color={colors.destructive}>
              {errorLugares}
            </Text>
            <Button
              variant="outline"
              label="Reintentar"
              onPress={() => {
                setErrorLugares(null);
                setIntento((n) => n + 1);
              }}
              style={{ alignSelf: 'flex-start' }}
            />
          </View>
        ) : !lugares ? (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primaryText} />
            <Text color={colors.mutedForeground}>Cargando departamentos y ciudades…</Text>
          </View>
        ) : (
          <Fila>
            <Col>
              <Pregunta etiqueta="Departamento" error={errores.id_departamento}>
                <SelectorLista
                  titulo="Departamento"
                  opciones={lugares}
                  valor={d.id_departamento}
                  error={!!errores.id_departamento}
                  disabled={disabled}
                  onCambiar={(id) => {
                    if (id !== d.id_departamento) set('id_ciudad', null);
                    set('id_departamento', id);
                  }}
                />
              </Pregunta>
            </Col>
            <Col>
              <Pregunta etiqueta="Ciudad" error={errores.id_ciudad} ayuda={depto ? undefined : 'Primero elegí el departamento.'}>
                <SelectorLista titulo="Ciudad" opciones={depto?.ciudades ?? []} valor={d.id_ciudad} error={!!errores.id_ciudad} disabled={disabled || !depto} onCambiar={(id) => set('id_ciudad', id)} />
              </Pregunta>
            </Col>
          </Fila>
        )}
        <CampoEscrito ctx={ctx} campo="direccion" etiqueta="Dirección" placeholder="Calle, número y barrio" maxLength={300} />
      </Seccion>

      <Seccion titulo="Ubicación de tu casa">
        <Text size={13} color={colors.mutedForeground} style={{ lineHeight: 20 }}>
          Si estás en tu casa, tocá <Text size={13} weight="semibold">Usar mi ubicación</Text>. Si no, abrí Google Maps, buscá tu casa, tocá <Text size={13} weight="semibold">Compartir</Text> y pegá el enlace abajo.
        </Text>
        <Button icon={LocateFixed} label={buscandoGps ? 'Buscando tu ubicación…' : 'Usar mi ubicación'} onPress={() => void usarGps()} disabled={disabled || buscandoGps} style={{ alignSelf: 'flex-start' }} />
        {errorGps ? (
          <Text accessibilityRole="alert" size={12} color={colors.destructive}>
            {errorGps}
          </Text>
        ) : null}
        <CampoEscrito ctx={ctx} campo="ubicacion_domicilio" etiqueta="Ubicación" placeholder="-25.282197, -57.635099 o https://maps.app.goo.gl/…" autoCapitalize="none" autoCorrect={false} maxLength={300} />
        {mapa ? (
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(mapa)} style={s.enlace}>
            <ExternalLink size={14} color={colors.primaryText} />
            <Text size={13} weight="semibold" color={colors.primaryText}>
              Ver en el mapa
            </Text>
          </Pressable>
        ) : null}
      </Seccion>
    </>
  );
}

/** Lista con buscador en un panel (para las ~260 ciudades). */
function SelectorLista({ titulo, opciones, valor, onCambiar, error, disabled }: { titulo: string; opciones: Lugar[]; valor: number | null; onCambiar: (id: number) => void; error?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  const s = useStyles();
  const [abierto, setAbierto] = useState(false);
  const [busca, setBusca] = useState('');
  const elegido = opciones.find((o) => o.id === valor);
  const normal = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  const filtradas = useMemo(() => {
    const q = normal(busca.trim());
    return q ? opciones.filter((o) => normal(o.nombre).includes(q)) : opciones;
  }, [busca, opciones]);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${titulo}: ${elegido?.nombre ?? 'sin elegir'}`}
        disabled={disabled}
        onPress={() => {
          setBusca('');
          setAbierto(true);
        }}
        style={({ pressed }) => [s.selector, error && { borderColor: colors.destructive }, pressed && { opacity: 0.75 }, disabled && { opacity: 0.5 }]}
      >
        <Text size={15} weight={elegido ? 'semibold' : 'regular'} color={elegido ? colors.foreground : colors.mutedForeground} style={{ flex: 1 }} numberOfLines={1}>
          {elegido?.nombre ?? `Elegí ${titulo.toLowerCase()}`}
        </Text>
        <ChevronDown size={18} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={abierto} onClose={() => setAbierto(false)} title={titulo}>
        <View style={{ gap: 12 }}>
          <View style={s.buscador}>
            <Search size={16} color={colors.mutedForeground} />
            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar…"
              placeholderTextColor={colors.mutedForeground}
              keyboardAppearance={colors.scheme}
              autoCorrect={false}
              style={{ flex: 1, color: colors.foreground, fontSize: 15, paddingVertical: 10 }}
              accessibilityLabel={`Buscar ${titulo.toLowerCase()}`}
            />
          </View>
          <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {filtradas.length === 0 ? (
              <Text size={13} color={colors.mutedForeground} style={{ padding: 12 }}>
                No hay resultados.
              </Text>
            ) : (
              filtradas.map((o) => {
                const sel = o.id === valor;
                return (
                  <Pressable
                    key={o.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sel }}
                    onPress={() => {
                      onCambiar(o.id);
                      setAbierto(false);
                    }}
                    style={({ pressed }) => [s.item, sel && { backgroundColor: colors.secondary }, pressed && { backgroundColor: colors.muted }]}
                  >
                    <Text size={14} weight={sel ? 'semibold' : 'regular'} color={sel ? colors.primaryText : colors.foreground} style={{ flex: 1 }}>
                      {o.nombre}
                    </Text>
                    {sel && <Check size={16} color={colors.primaryText} />}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function PasoEstudios(ctx: CtxPaso) {
  const { d } = ctx;
  return (
    <>
      {NIVELES.map((n) => {
        const estado = d[campoNivel(n.nivel, 'estado')];
        return (
          <Seccion key={n.nivel} titulo={n.titulo} icono={GraduationCap}>
            <CampoOpciones ctx={ctx} campo={campoNivel(n.nivel, 'estado')} etiqueta={`¿Cómo está tu ${n.titulo.toLowerCase()}?`} opciones={n.opciones} />
            {pideTitulo(estado) && (
              <Fila>
                <Col>
                  <CampoEscrito ctx={ctx} campo={campoNivel(n.nivel, 'titulo')} etiqueta={n.nivel === 'secundario' ? 'Título de bachiller' : 'Nombre de la carrera'} placeholder={n.ejemplo} maxLength={200} />
                </Col>
                {n.conAnio && estado === 'CURSANDO' && (
                  <Col>
                    <CampoEscrito ctx={ctx} campo={campoNivel(n.nivel, 'anio')} etiqueta="Curso actual" placeholder="2/4" ayuda="El curso que hacés y el total: 2/4 es 2.º de 4." keyboardType="numbers-and-punctuation" maxLength={10} />
                  </Col>
                )}
              </Fila>
            )}
          </Seccion>
        );
      })}
    </>
  );
}

function PasoTrabajo(ctx: CtxPaso) {
  const { d } = ctx;
  return (
    <>
      <Seccion titulo="Trabajo" icono={BriefcaseBusiness}>
        <CampoOpciones ctx={ctx} campo="actividad_laboral" etiqueta="¿Trabajás actualmente?" opciones={SI_NO} />
        {d.actividad_laboral === 'SI' && (
          <Fila>
            <Col>
              <CampoEscrito ctx={ctx} campo="empresa" etiqueta="Empresa o institución" maxLength={200} />
            </Col>
            <Col>
              <CampoEscrito ctx={ctx} campo="cargo" etiqueta="Cargo" maxLength={200} />
            </Col>
          </Fila>
        )}
      </Seccion>
      <Seccion titulo="Recursos">
        <CampoOpciones ctx={ctx} campo="movilidad_propia" etiqueta="¿Tenés movilidad propia?" opciones={SI_NO} />
        {d.movilidad_propia === 'SI' && <CampoOpciones ctx={ctx} campo="tipo_vehiculo" etiqueta="¿Qué vehículo?" opciones={TIPO_VEHICULO} />}
        <CampoOpciones ctx={ctx} campo="computadora_propia" etiqueta="¿Tenés computadora propia?" opciones={SI_NO} />
        <CampoOpciones ctx={ctx} campo="internet_estable" etiqueta="¿Tenés internet estable (WiFi)?" opciones={SI_NO} />
        <CampoOpciones ctx={ctx} campo="manejo_office" etiqueta="¿Manejás herramientas de Office (Word, Excel, PDF)?" opciones={SI_NO} />
      </Seccion>
    </>
  );
}

function PasoDisponibilidad({ d, set, errores, disabled }: CtxPaso) {
  const { colors } = useTheme();
  const s = useStyles();
  const todos = d.dias_disponibles.length === DIAS.length;
  const alternar = (v: string) => {
    const nuevos = d.dias_disponibles.includes(v) ? d.dias_disponibles.filter((x) => x !== v) : [...d.dias_disponibles, v];
    set(
      'dias_disponibles',
      DIAS.map((x) => x.valor).filter((x) => nuevos.includes(x)),
    );
  };
  return (
    <Seccion titulo="¿Cuándo podés trabajar?" icono={CalendarClock}>
      <Pregunta etiqueta="Días disponibles" error={errores.dias_disponibles} ayuda="Tocá todos los días que tenés libres.">
        <View style={s.dias}>
          {DIAS.map((o) => {
            const sel = d.dias_disponibles.includes(o.valor);
            return (
              <Pressable
                key={o.valor}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: sel, disabled }}
                accessibilityLabel={o.label}
                disabled={disabled}
                onPress={() => alternar(o.valor)}
                style={({ pressed }) => [s.dia, sel && { backgroundColor: colors.primary, borderColor: colors.primary }, errores.dias_disponibles && !sel && { borderColor: colors.destructive }, pressed && { opacity: 0.75 }]}
              >
                <Text size={18} weight="bold" color={sel ? colors.primaryForeground : colors.foreground}>
                  {o.label.slice(0, 2)}
                </Text>
                <Text size={10} color={sel ? colors.primaryForeground : colors.mutedForeground}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Button
          variant="link"
          label={todos ? 'Quitar todos' : 'Elegir de lunes a viernes'}
          onPress={() =>
            set(
              'dias_disponibles',
              todos ? [] : DIAS.map((x) => x.valor),
            )
          }
          disabled={disabled}
          style={{ alignSelf: 'flex-start', height: 28 }}
        />
      </Pregunta>
      <Pregunta etiqueta="Turno" error={errores.turno}>
        <Opciones etiqueta="Turno" opciones={TURNOS} valor={d.turno} onCambiar={(v) => set('turno', v)} error={!!errores.turno} disabled={disabled} />
      </Pregunta>
    </Seccion>
  );
}

function PasoIglesia(ctx: CtxPaso) {
  const { colors } = useTheme();
  return (
    <>
      <Seccion titulo="Tu iglesia" icono={Church}>
        <Fila>
          <Col>
            <CampoEscrito ctx={ctx} campo="iglesia_denominacion" etiqueta="Denominación" placeholder="Por ejemplo: Bautista, Asambleas de Dios" maxLength={200} />
          </Col>
          <Col>
            <CampoEscrito ctx={ctx} campo="iglesia_nombre" etiqueta="Nombre de la iglesia" maxLength={200} />
          </Col>
        </Fila>
        <CampoOpciones ctx={ctx} campo="bautizado_agua" etiqueta="¿Estás bautizado en agua?" opciones={SI_NO} />
      </Seccion>
      <Seccion titulo="Referencias">
        <Fila>
          <Col>
            <CampoEscrito ctx={ctx} campo="pastor_nombre" etiqueta="Pastor principal" autoCapitalize="words" maxLength={200} />
          </Col>
          <Col>
            <CampoEscrito ctx={ctx} campo="pastor_telefono" etiqueta="Teléfono del pastor" keyboardType="phone-pad" maxLength={30} />
          </Col>
        </Fila>
        <Fila>
          <Col>
            <CampoEscrito ctx={ctx} campo="lider_nombre" etiqueta="Tu líder directo" autoCapitalize="words" maxLength={200} />
          </Col>
          <Col>
            <CampoEscrito ctx={ctx} campo="lider_telefono" etiqueta="Teléfono del líder" keyboardType="phone-pad" maxLength={30} />
          </Col>
        </Fila>
      </Seccion>
      <Seccion titulo="Tu servicio">
        <CampoEscrito ctx={ctx} campo="areas_ministerio" etiqueta="¿En qué áreas, servicios o ministerios servís?" placeholder="Por ejemplo: jóvenes, alabanza, escuela dominical" multiline maxLength={LARGO_AREAS} />
        <Text size={11} color={colors.mutedForeground} style={{ textAlign: 'right', marginTop: -12 }}>
          {ctx.d.areas_ministerio.length}/{LARGO_AREAS}
        </Text>
      </Seccion>
    </>
  );
}

function PasoCobro(ctx: CtxPaso) {
  const { d, set, errores, disabled } = ctx;
  const { colors } = useTheme();
  const soyTitular = !!d.nombre_completo && d.titular_nombre === d.nombre_completo && soloCedula(d.titular_ci) === soloCedula(d.cedula);
  return (
    <>
      <Seccion titulo="Cuenta para el cobro" icono={Banknote}>
        <Fila>
          <Col>
            <CampoEscrito ctx={ctx} campo="banco_nombre" etiqueta="Banco" maxLength={100} />
          </Col>
          <Col>
            <CampoEscrito ctx={ctx} campo="banco_sucursal" etiqueta="Sucursal" maxLength={100} />
          </Col>
        </Fila>
        <Pregunta etiqueta="Tipo de cuenta" error={errores.tipo_cuenta}>
          <Opciones
            etiqueta="Tipo de cuenta"
            opciones={TIPOS_CUENTA.map((t) => ({ valor: t, label: t }))}
            valor={d.tipo_cuenta}
            onCambiar={(v) => set('tipo_cuenta', v)}
            error={!!errores.tipo_cuenta}
            disabled={disabled}
          />
          {!TIPOS_CUENTA.includes(d.tipo_cuenta) && d.tipo_cuenta ? <Entrada valor={d.tipo_cuenta} onCambiar={(v) => set('tipo_cuenta', v)} maxLength={50} disabled={disabled} accessibilityLabel="Tipo de cuenta" /> : null}
        </Pregunta>
        <CampoEscrito ctx={ctx} campo="numero_cuenta" etiqueta="Número de cuenta" keyboardType="number-pad" maxLength={50} />
      </Seccion>

      <Seccion titulo="Titular de la cuenta">
        <Button
          variant={soyTitular ? 'secondary' : 'outline'}
          icon={soyTitular ? Check : UserRound}
          label={soyTitular ? 'La cuenta es mía' : 'La cuenta es mía: usar mis datos'}
          onPress={() => {
            set('titular_nombre', d.nombre_completo);
            set('titular_ci', soloCedula(d.cedula));
          }}
          disabled={disabled || !d.nombre_completo}
          style={{ alignSelf: 'flex-start' }}
        />
        <Fila>
          <Col>
            <CampoEscrito ctx={ctx} campo="titular_nombre" etiqueta="Nombre del titular" autoCapitalize="words" maxLength={200} />
          </Col>
          <Col>
            <CampoEscrito ctx={ctx} campo="titular_ci" etiqueta="Cédula del titular" keyboardType="number-pad" maxLength={20} />
          </Col>
        </Fila>
      </Seccion>

      <Seccion titulo="Factura">
        <CampoOpciones ctx={ctx} campo="factura_tipo" etiqueta="¿Qué factura emitís?" opciones={FACTURA_TIPO} />
        <Fila>
          <Col>
            <CampoEscrito ctx={ctx} campo="factura_emisor" etiqueta="Emisor de la factura" ayuda="A nombre de quién sale la factura." autoCapitalize="words" maxLength={200} />
          </Col>
          <Col>
            <CampoEscrito ctx={ctx} campo="ruc" etiqueta="RUC" placeholder="1234567-8" keyboardType="numbers-and-punctuation" maxLength={30} ayuda="Con el dígito verificador." />
          </Col>
        </Fila>
        {d.nombre_completo && d.factura_emisor !== d.nombre_completo ? (
          <Pressable accessibilityRole="button" onPress={() => set('factura_emisor', d.nombre_completo)} disabled={disabled}>
            <Text size={12} weight="semibold" color={colors.primaryText}>
              La factura la emito yo
            </Text>
          </Pressable>
        ) : null}
      </Seccion>
    </>
  );
}

function PasoDocumentos({ d, set, errores, disabled }: CtxPaso) {
  const { colors } = useTheme();
  return (
    <>
      <Seccion titulo="Tus documentos" icono={FileUp}>
        <Text size={13} color={colors.mutedForeground} style={{ lineHeight: 20 }}>
          Subí una foto clara o un PDF de cada documento. Se suben apenas los elegís. Si te equivocaste, elegilo de nuevo o tocá Quitar: el anterior se borra.
        </Text>
      </Seccion>
      {documentosRequeridos(d).map((doc) => (
        <TarjetaDocumento key={doc.campo} doc={doc} url={d[doc.campo]} error={errores[doc.campo]} disabled={disabled} onSubido={(u) => set(doc.campo, u)} />
      ))}
    </>
  );
}

function TarjetaDocumento({ doc, url, error, disabled, onSubido }: { doc: Documento; url: string; error?: string; disabled: boolean; onSubido: (url: string) => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const [subiendo, setSubiendo] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);

  const cargar = async (elegir: () => Promise<ArchivoLocal | null>) => {
    setFalla(null);
    try {
      const archivo = await elegir();
      if (!archivo) return;
      setSubiendo(true);
      const anterior = url;
      onSubido(await subirDocumento(archivo));
      // El reemplazado se borra de Cloudinary (si una postulación guardada lo usa, al guardar).
      quitarDocumento(anterior);
    } catch (e) {
      setFalla(e instanceof Error ? e.message : 'No se pudo subir el archivo. Probá de nuevo.');
    } finally {
      setSubiendo(false);
    }
  };

  const ocupado = disabled || subiendo;
  const mensaje = falla ?? (url ? undefined : error);
  return (
    <Card style={[{ gap: 12 }, mensaje ? { borderColor: colors.destructive } : null]}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={s.docMiniatura}>
          {subiendo ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : url ? (
            <Image source={{ uri: miniatura(url, 160) }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={doc.titulo} />
          ) : (
            <FileText size={22} color={colors.mutedForeground} />
          )}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text weight="bold" size={14}>
            {doc.titulo}
          </Text>
          <Text size={12} color={colors.mutedForeground} style={{ lineHeight: 17 }}>
            {subiendo ? 'Subiendo…' : url ? (esPdf(url) ? 'PDF subido.' : 'Foto subida.') : doc.ayuda}
          </Text>
          {url && !subiendo ? (
            <Pressable accessibilityRole="link" accessibilityLabel={`Ver ${doc.titulo.toLowerCase()}`} onPress={() => void Linking.openURL(url)} style={s.enlace}>
              <ExternalLink size={13} color={colors.primaryText} />
              <Text size={12} weight="semibold" color={colors.primaryText}>
                Ver
              </Text>
            </Pressable>
          ) : null}
        </View>
        {url && !subiendo ? <CircleCheck size={20} color={colors.success} accessibilityLabel="Subido" /> : null}
      </View>
      <View style={s.opciones}>
        <Button size="sm" variant={url ? 'outline' : 'default'} icon={Camera} label="Sacar foto" onPress={() => void cargar(() => fotoDeDocumento('camara'))} disabled={ocupado} accessibilityLabel={`Sacar foto: ${doc.titulo}`} />
        <Button size="sm" variant="outline" icon={ImagePlus} label="Galería" onPress={() => void cargar(() => fotoDeDocumento('galeria'))} disabled={ocupado} accessibilityLabel={`Elegir de la galería: ${doc.titulo}`} />
        {!doc.soloFoto && <Button size="sm" variant="outline" icon={FileUp} label="PDF" onPress={() => void cargar(pdfDeDocumento)} disabled={ocupado} accessibilityLabel={`Elegir un PDF: ${doc.titulo}`} />}
        {url ? (
          <Button
            size="sm"
            variant="ghost"
            icon={Trash2}
            label="Quitar"
            onPress={() => {
              onSubido('');
              quitarDocumento(url);
            }}
            disabled={ocupado}
            accessibilityLabel={`Quitar ${doc.titulo.toLowerCase()}`}
          />
        ) : null}
      </View>
      {mensaje ? (
        <Text accessibilityRole="alert" size={12} color={colors.destructive}>
          {mensaje}
        </Text>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------------- */
/* Revisión (también en la pantalla, una vez enviada)                        */
/* ------------------------------------------------------------------------- */

/** Etiqueta, valor y, si es un documento, su enlace. */
type Renglon = [string, string, string?];

export function Resumen({ datos: d, lugar, onEditar }: { datos: Datos; lugar?: { departamento: string; ciudad: string }; onEditar?: (paso: number) => void }) {
  const [lugares, setLugares] = useState<Departamento[] | null>(null);
  useEffect(() => {
    if (lugar) return;
    let vigente = true;
    cargarLugares()
      .then((l) => vigente && setLugares(l))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [lugar]);
  const depto = lugares?.find((x) => x.id === d.id_departamento);
  const departamento = lugar?.departamento ?? depto?.nombre ?? '';
  const ciudad = lugar?.ciudad ?? depto?.ciudades.find((c) => c.id === d.id_ciudad)?.nombre ?? '';
  const sino = (v: string) => etiquetaDe(SI_NO, v);
  const fecha = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.fecha_nacimiento);
    if (!m) return '';
    const edad = edadDe(d.fecha_nacimiento);
    return `${Number(m[3])} de ${MESES[Number(m[2]) - 1] ?? ''} de ${m[1]}${edad !== null ? ` (${edad} años)` : ''}`;
  })();

  const secciones: { paso: PasoId; renglones: Renglon[] }[] = [
    {
      paso: 'personales',
      renglones: [
        ['Nombre', d.nombre_completo],
        ['Cédula', d.cedula],
        ['Nacimiento', fecha],
        ['Nacionalidad', d.nacionalidad],
        ['Teléfono', d.telefono],
        ['Correo', d.correo_electronico],
        ['Estado civil', d.estado_civil === 'OTROS' ? d.estado_civil_otro : etiquetaDe(ESTADO_CIVIL, d.estado_civil)],
        ['Vive', etiquetaDe(VIVE_CON, d.vive_con)],
        ['Hijos', sino(d.hijos)],
        ['Talle de remera', d.talle_remera || '—'],
      ],
    },
    {
      paso: 'domicilio',
      renglones: [
        ['Ciudad', [ciudad, departamento].filter(Boolean).join(', ')],
        ['Dirección', d.direccion],
        ['Ubicación', d.ubicacion_domicilio],
      ],
    },
    {
      paso: 'estudios',
      renglones: NIVELES.map((n): Renglon => {
        const estado = d[campoNivel(n.nivel, 'estado')];
        const titulo = d[campoNivel(n.nivel, 'titulo')];
        const curso = n.conAnio && estado === 'CURSANDO' ? ` (${d[campoNivel(n.nivel, 'anio')]})` : '';
        return [n.titulo, `${etiquetaDe(n.opciones, estado)}${pideTitulo(estado) && titulo ? ` · ${titulo}` : ''}${curso}`];
      }),
    },
    {
      paso: 'trabajo',
      renglones: [
        ['Trabaja', d.actividad_laboral === 'SI' ? `Sí · ${d.cargo} en ${d.empresa}` : sino(d.actividad_laboral)],
        ['Movilidad propia', d.movilidad_propia === 'SI' ? `Sí · ${etiquetaDe(TIPO_VEHICULO, d.tipo_vehiculo)}` : sino(d.movilidad_propia)],
        ['Computadora propia', sino(d.computadora_propia)],
        ['Internet estable', sino(d.internet_estable)],
        ['Maneja Office', sino(d.manejo_office)],
      ],
    },
    {
      paso: 'disponibilidad',
      renglones: [
        ['Días', d.dias_disponibles.map((x) => etiquetaDe(DIAS, x)).join(', ')],
        ['Turno', etiquetaDe(TURNOS, d.turno)],
      ],
    },
    {
      paso: 'iglesia',
      renglones: [
        ['Iglesia', [d.iglesia_nombre, d.iglesia_denominacion].filter(Boolean).join(' · ')],
        ['Pastor', [d.pastor_nombre, d.pastor_telefono].filter(Boolean).join(' · ')],
        ['Líder', [d.lider_nombre, d.lider_telefono].filter(Boolean).join(' · ')],
        ['Bautizado en agua', sino(d.bautizado_agua)],
        ['Áreas en las que sirve', d.areas_ministerio],
      ],
    },
    {
      paso: 'cobro',
      renglones: [
        ['Banco', [d.banco_nombre, d.banco_sucursal].filter(Boolean).join(' · ')],
        ['Cuenta', [d.tipo_cuenta, d.numero_cuenta].filter(Boolean).join(' · ')],
        ['Titular', [d.titular_nombre, d.titular_ci ? `CI ${d.titular_ci}` : ''].filter(Boolean).join(' · ')],
        ['Factura', etiquetaDe(FACTURA_TIPO, d.factura_tipo)],
        ['Emisor', [d.factura_emisor, d.ruc ? `RUC ${d.ruc}` : ''].filter(Boolean).join(' · ')],
      ],
    },
    {
      paso: 'documentos',
      renglones: documentosRequeridos(d).map((doc): Renglon => {
        const url = d[doc.campo];
        return [doc.titulo, url ? (esPdf(url) ? 'PDF' : 'Foto') : 'Falta subir', url || undefined];
      }),
    },
  ];

  return (
    <View style={{ gap: 12 }}>
      {secciones.map((sec) => {
        const i = PASOS.findIndex((p) => p.id === sec.paso);
        const info = PASOS[i];
        return info ? <BloqueResumen key={sec.paso} titulo={info.titulo} icono={ICONO_PASO[sec.paso]} renglones={sec.renglones} onEditar={onEditar ? () => onEditar(i) : undefined} /> : null;
      })}
    </View>
  );
}

function BloqueResumen({ titulo, icono: Icono, renglones, onEditar }: { titulo: string; icono: LucideIcon; renglones: Renglon[]; onEditar?: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icono size={16} color={colors.primaryText} />
        <Text weight="bold" size={14} style={{ flex: 1 }}>
          {titulo}
        </Text>
        {onEditar && <Button variant="ghost" size="sm" icon={Pencil} label="Editar" onPress={onEditar} accessibilityLabel={`Editar ${titulo.toLowerCase()}`} />}
      </View>
      {renglones.map(([k, v, url]) => (
        <View key={k} style={s.renglon}>
          <Text size={12} color={colors.mutedForeground} style={{ width: 130 }}>
            {k}
          </Text>
          <Text size={13} weight="medium" style={{ flex: 1 }}>
            {v || '—'}
          </Text>
          {url ? (
            <Pressable accessibilityRole="link" accessibilityLabel={`Ver ${k.toLowerCase()}`} onPress={() => void Linking.openURL(url)} style={s.enlace}>
              <ExternalLink size={13} color={colors.primaryText} />
              <Text size={12} weight="semibold" color={colors.primaryText}>
                Ver
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    encabezado: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    barra: { height: 6, borderRadius: 3, backgroundColor: c.muted, overflow: 'hidden' },
    barraRelleno: { height: 6, borderRadius: 3, backgroundColor: c.primary },
    chips: { gap: 8, paddingRight: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 30, borderRadius: 15, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
    input: { minHeight: 48, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: 12, color: c.foreground, backgroundColor: c.card, fontSize: 16 },
    opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    opcion: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 42, paddingHorizontal: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.background },
    tarjetasOpcion: { gap: 10 },
    tarjetaOpcion: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.lg, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.card },
    fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
    selector: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.card },
    buscador: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.card },
    item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.md },
    enlace: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
    docMiniatura: { width: 64, height: 64, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.muted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    dias: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    dia: { width: 64, height: 64, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', gap: 2 },
    alerta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    navegacion: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 4 },
    principalCelular: { flexGrow: 1, paddingHorizontal: 18 },
    renglon: { flexDirection: 'row', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border },
  }),
);
