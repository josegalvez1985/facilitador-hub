// "Mi postulación": cualquier usuario con sesión, sea o no facilitador (24/11/2026), se postula para
// el año lectivo. Endpoints mi-postulacion/* (sql/postulacion_app_ethos.sql →
// PKG_POSTULACION_APP_ETHOS): el servidor identifica la postulación por el usuario del token y, si es
// facilitador, por su ID_FACILITADOR. Es la excepción deliberada a "sin ID_FACILITADOR no se piden
// datos": solo devuelve la postulación propia. Una por año: si ya la envió, resumen y corrección.
// - Sin enviar: se puede empezar con los datos de la postulación de otro año (o de cero).
// - Lo cargado y no enviado queda en memoria mientras la app está abierta (postulacion.ts).

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CalendarX2, Check, CircleCheck, ClipboardPen, Copy, Pencil, RefreshCw, RotateCcw, Trash2, UserRound } from 'lucide-react-native';

import { useSession } from '../auth/session';
import { AvancePostulacion, avisoDe, DetalleFaltantes, PildoraPlazo, TarjetaAviso, useFijarAviso } from '../aviso-postulacion';
import { FormularioPostulacion, Resumen } from '../postulacion-form';
import {
  borrarBorrador,
  cargarPostulacion,
  datosVacios,
  faltantes,
  descartarGuardada,
  eliminarPostulacion,
  FALTA_PUBLICAR,
  faltaPublicar,
  guardarBorrador,
  isoADma,
  textoPeriodo,
  leerBorrador,
  PASOS,
  PASOS_A_COMPLETAR,
  pasoParaRetomar,
  pasosCompletos,
  textoCierre,
  quitarDocumentosDe,
  type Datos,
  type EstadoPostulacion,
} from '../postulacion';
import { radius } from '../theme';
import { makeStyles, useTheme } from '../theme-provider';
import { useToast } from '../toast';
import { Badge, Button, Card, Modal, ModalActions, ModalText, PageTitle, Text } from '../ui';

type Resultado = { clave: string } & ({ tipo: 'error'; mensaje: string } | { tipo: 'listo'; estado: EstadoPostulacion });
type Form = { datos: Datos; paso: number; alcanzado?: number };

export function PostulacionScreen() {
  const { colors } = useTheme();
  const s = useStyles();
  const { sesion, facilitador, reintentarFacilitador } = useSession();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [intento, setIntento] = useState(0);
  const [form, setForm] = useState<Form | null>(null);
  const toast = useToast();
  const fijarAviso = useFijarAviso();
  const [eliminar, setEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  // Se espera a saber si es facilitador (o no), pero sin ID_FACILITADOR también se postula:
  // el servidor devuelve solo la postulación de este usuario.
  const listo = facilitador.estado === 'listo';
  const quien = `${sesion?.usuario ?? ''}-${listo ? facilitador.id : ''}`;
  const clave = `${quien}-${intento}`;
  useEffect(() => {
    if (!listo) return;
    let vigente = true;
    cargarPostulacion()
      .then((estado) => {
        if (!vigente) return;
        setResultado({ clave, tipo: 'listo', estado });
        // Inicio y la campana muestran lo que falta: se actualizan con esto, sin otra consulta.
        fijarAviso(estado);
      })
      .catch((e: unknown) => vigente && setResultado({ clave, tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo cargar tu postulación' }));
    return () => {
      vigente = false;
    };
    // fijarAviso cambia en cada render y solo escribe la caché: no hace falta volver a cargar por eso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, clave]);

  const estado = resultado && resultado.clave === clave ? resultado : null;
  const recargar = () => {
    if (facilitador.estado === 'error') reintentarFacilitador();
    else setIntento((n) => n + 1);
  };

  // Elimina la enviada: el servidor borra también sus documentos. Lo cargado sin enviar
  // (la corrección en curso) se descarta, con sus documentos nuevos.
  const confirmarEliminar = async () => {
    setEliminando(true);
    setErrorEliminar(null);
    try {
      await eliminarPostulacion();
      const b = leerBorrador(claveBorrador);
      if (b) quitarDocumentosDe(b.datos);
      borrarBorrador();
      setEliminar(false);
      toast.success('Postulación eliminada. Podés cargarla de nuevo.');
      recargar();
    } catch (err) {
      setErrorEliminar(err instanceof Error ? err.message : 'No se pudo eliminar la postulación.');
    } finally {
      setEliminando(false);
    }
  };

  const anio = estado?.tipo === 'listo' ? estado.estado.anio : '';
  const claveBorrador = `${sesion?.usuario ?? ''}-${anio}`;
  const onCambio = useCallback((datos: Datos, paso: number) => guardarBorrador(claveBorrador, datos, paso), [claveBorrador]);

  if (form && estado?.tipo === 'listo') {
    return (
      <FormularioPostulacion
        anio={anio}
        esFacilitador={estado.estado.esFacilitador}
        proceso={estado.estado.proceso}
        datosIniciales={form.datos}
        pasoInicial={form.paso}
        alcanzadoInicial={form.alcanzado}
        esCorreccion={estado.estado.postulacion !== null}
        onCambio={onCambio}
        onSalir={() => setForm(null)}
        onEnviada={() => {
          borrarBorrador();
          setForm(null);
          recargar();
        }}
        onGuardada={() => {
          borrarBorrador();
          setForm(null);
          recargar();
        }}
      />
    );
  }

  const encabezado = (
    <PageTitle title="Mi postulación" subtitle="Postulate para el año lectivo y mantené tus datos al día.">
      <Button size="icon" variant="outline" icon={RefreshCw} accessibilityLabel="Actualizar" onPress={recargar} disabled={facilitador.estado === 'cargando' || (listo && !estado)} />
    </PageTitle>
  );

  if (facilitador.estado === 'cargando') {
    return (
      <>
        {encabezado}
        <Cargando texto="Identificando al facilitador…" />
      </>
    );
  }
  if (facilitador.estado === 'error') {
    return (
      <>
        {encabezado}
        <ErrorCard mensaje={facilitador.mensaje} onReintentar={recargar} />
      </>
    );
  }
  if (!estado) {
    return (
      <>
        {encabezado}
        <Cargando texto="Cargando tu postulación…" />
      </>
    );
  }
  if (estado.tipo === 'error') {
    return (
      <>
        {encabezado}
        <ErrorCard mensaje={faltaPublicar(estado.mensaje) ? FALTA_PUBLICAR : estado.mensaje} onReintentar={recargar} />
      </>
    );
  }

  const e = estado.estado;
  // Sin el año lectivo en ANIOS_LECTIVOS no hay nada que mostrar. El período (abierta) se mira abajo:
  // cerrado, la postulación se ve pero no se modifica.
  if (!e.anioRegistrado) {
    return (
      <>
        {encabezado}
        <Vacio icono={CalendarX2} texto="En este momento no hay una postulación abierta. Cuando la coordinación la habilite, la vas a ver acá." />
      </>
    );
  }

  // Lo cargado sin enviar: lo de esta sesión (en memoria) o, si no, lo guardado sin terminar en el servidor.
  const borrador = leerBorrador(claveBorrador) ?? (e.guardada ? { datos: e.guardada.datos, paso: e.guardada.paso } : null);
  // "Sin empezar" ya lo dice la tarjeta de abajo: acá solo lo que falta.
  const cierre = textoCierre(e);
  // Avance y tildes con lo mismo que usa "Seguir donde dejaste": el borrador en memoria si lo hay.
  const avance = borrador ? faltantes(borrador.datos) : null;
  const aviso = (() => {
    const a = avisoDe(e);
    return a && a.tipo !== 'sin-empezar' ? a : null;
  })();
  // Descartar: los documentos que solo usaba lo descartado se borran de Cloudinary.
  const descartar = () => {
    if (borrador) quitarDocumentosDe(borrador.datos);
    borrarBorrador();
    if (e.guardada) descartarGuardada().catch(() => {});
  };

  // Ya enviada: el resumen y "Corregir".
  if (e.postulacion) {
    const p = e.postulacion;
    return (
      <>
        {encabezado}
        <View style={{ maxWidth: 720, width: '100%', gap: 16 }}>
          {aviso && <TarjetaAviso aviso={aviso} detalle />}
          <Card style={s.hero}>
            <View style={[s.heroIcono, { backgroundColor: colors.successSoft }]}>
              <CircleCheck size={26} color={colors.success} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Badge tone="success" label="ENVIADA" />
              <Text weight="bold" size={18}>
                Tu postulación {e.anio} está enviada
              </Text>
              {p.fechaRegistro ? (
                <Text size={12} color={colors.mutedForeground}>
                  La enviaste el {isoADma(p.fechaRegistro)} a las {p.fechaRegistro.slice(11, 16)}.
                </Text>
              ) : null}
              <Text size={13} color={colors.mutedForeground} style={{ lineHeight: 19, marginTop: 4 }}>
                {e.abierta ? `Si cambió algún dato, corregila mientras el período esté abierto. ${textoPeriodo(e)}` : `${textoPeriodo(e)} Ya no se puede modificar.`}
              </Text>
            </View>
          </Card>
          {e.abierta && (
          <View style={s.acciones}>
            <Button icon={Pencil} label={borrador ? 'Seguir corrigiendo' : 'Corregir mi postulación'} onPress={() => setForm(borrador ? { datos: borrador.datos, paso: pasoParaRetomar(borrador.datos), alcanzado: PASOS.length - 1 } : { datos: { ...p.datos, acepta_proceso: 'DE_ACUERDO' }, paso: 1 })} />
            {borrador && (
              <Button
                variant="outline"
                icon={RotateCcw}
                label="Descartar cambios"
                onPress={() => {
                  descartar();
                  setIntento((n) => n + 1);
                }}
              />
            )}
          </View>
          )}
          {/* Período cerrado: solo lectura (sin Editar ni Eliminar). */}
          <Resumen datos={p.datos} lugar={{ departamento: p.departamento, ciudad: p.ciudad }} onEditar={e.abierta ? (paso) => setForm({ datos: { ...p.datos, acepta_proceso: 'DE_ACUERDO' }, paso }) : undefined} />
          {e.abierta && <Button variant="ghost" icon={Trash2} label="Eliminar mi postulación" textStyle={{ color: colors.destructive }} onPress={() => setEliminar(true)} style={{ alignSelf: 'flex-start' }} />}
        </View>
        <Modal visible={eliminar} onClose={() => !eliminando && setEliminar(false)} title="¿Eliminar tu postulación?" closeLabel="Cancelar">
          <ModalText>Se borran tu postulación {e.anio} y los documentos que subiste. Después podés cargarla de nuevo desde cero.</ModalText>
          {errorEliminar ? (
            <Text accessibilityRole="alert" size={13} color={colors.destructive}>
              {errorEliminar}
            </Text>
          ) : null}
          <ModalActions>
            <Button variant="outline" label="Cancelar" onPress={() => setEliminar(false)} disabled={eliminando} />
            <Button icon={Trash2} label={eliminando ? 'Eliminando…' : 'Eliminar'} onPress={() => void confirmarEliminar()} disabled={eliminando} />
          </ModalActions>
        </Modal>
      </>
    );
  }

  // Sin enviar: empezar (de cero, con los datos de otro año, o seguir el borrador).
  // Lo que ya se sabe: de FACILITADORES si es facilitador; si no, el nombre y el correo de la sesión.
  // Si ya es facilitador, todo lo que hay en FACILITADORES (deFacilitador); si no, lo de la sesión.
  const deCero = (): Datos => {
    const d: Datos = { ...datosVacios(), ...e.deFacilitador };
    if (!d.nombre_completo && sesion && sesion.nombre !== sesion.usuario) d.nombre_completo = sesion.nombre;
    if (!d.correo_electronico) d.correo_electronico = sesion?.email ?? '';
    return d;
  };
  const etiquetaEmpezar = e.esFacilitador ? 'Empezar con mis datos de facilitador' : 'Empezar de cero';

  // Sin enviar y con el período cerrado (todavía no abrió, ya cerró o no está cargado).
  if (!e.abierta) {
    return (
      <>
        {encabezado}
        <Vacio
          icono={CalendarX2}
          texto={`${textoPeriodo(e)}${e.guardada ? ' Tu postulación quedó guardada sin terminar y ya no se puede enviar. Si tenés dudas, consultá con la coordinación.' : ' Cuando esté abierto vas a poder postularte acá.'}`}
        />
      </>
    );
  }

  return (
    <>
      {encabezado}
      <View style={{ maxWidth: 720, width: '100%', gap: 16 }}>
        <Card style={s.hero}>
          <View style={[s.heroIcono, { backgroundColor: colors.secondary }]}>
            <ClipboardPen size={26} color={colors.primaryText} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Badge tone="accent" label="ABIERTA" />
            <Text weight="bold" size={20}>
              Postulación {e.anio}
            </Text>
            {cierre ? (
              <View style={{ alignSelf: 'flex-start' }}>
                <PildoraPlazo texto={cierre} />
              </View>
            ) : null}
            {textoPeriodo(e) ? (
              <Text size={12} weight="semibold" color={colors.primaryText}>
                {textoPeriodo(e)}
              </Text>
            ) : null}
            <Text size={13} color={colors.mutedForeground} style={{ lineHeight: 20 }}>
              {e.esFacilitador ? 'Contale a la fundación que querés seguir como facilitador este año y actualizá tus datos.' : 'Contale a la fundación que querés ser facilitador este año.'} Son {PASOS_A_COMPLETAR} pasos cortos, después revisás y enviás. Te lleva unos 10 minutos.
            </Text>
            {avance ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                <AvancePostulacion completos={pasosCompletos(avance)} />
                {avance.pasos.length === 0 && avance.archivos.length === 0 ? (
                  <Text size={13} color={colors.mutedForeground}>
                    Ya está todo completo: solo falta que la envíes.
                  </Text>
                ) : (
                  <DetalleFaltantes aviso={avance} />
                )}
              </View>
            ) : null}
          </View>
        </Card>

        <View style={s.pasos}>
          {PASOS.slice(0, -1).map((p, i) => {
            // Con algo ya cargado, los pasos completos llevan tilde.
            const completo = !!avance && !avance.pasos.some((x) => x.paso === i) && !(p.id === 'documentos' && avance.archivos.length > 0);
            return (
              <View key={p.id} style={s.pasoChip} accessible accessibilityLabel={`Paso ${i + 1}: ${p.titulo}${avance ? (completo ? ', completo' : ', falta completar') : ''}`}>
                {completo ? (
                  <Check size={13} color={colors.success} />
                ) : (
                  <Text size={11} weight="bold" color={colors.primaryText}>
                    {i + 1}
                  </Text>
                )}
                <Text size={12}>{p.titulo}</Text>
              </View>
            );
          })}
        </View>

        {borrador ? (
          <View style={s.acciones}>
            <Button size="lg" icon={Pencil} label="Seguir donde dejaste" onPress={() => setForm({ datos: borrador.datos, paso: pasoParaRetomar(borrador.datos), alcanzado: Math.max(borrador.paso, pasoParaRetomar(borrador.datos)) })} />
            <Button
              variant="outline"
              icon={RotateCcw}
              label="Empezar de nuevo"
              onPress={() => {
                descartar();
                setForm({ datos: deCero(), paso: 0 });
              }}
            />
          </View>
        ) : e.anterior ? (
          <Card style={{ gap: 12 }}>
            <Text weight="semibold" size={14}>
              Ya te postulaste en {e.anterior.anio}
            </Text>
            <Text size={13} color={colors.mutedForeground} style={{ lineHeight: 20 }}>
              Podés empezar con los datos de esa postulación y cambiar solo lo que haya cambiado.
            </Text>
            <View style={s.acciones}>
              <Button size="lg" icon={Copy} label={`Usar mis datos de ${e.anterior.anio}`} onPress={() => setForm({ datos: { ...e.anterior!.datos, acepta_proceso: '' }, paso: 0 })} />
              <Button variant="outline" label={etiquetaEmpezar} onPress={() => setForm({ datos: deCero(), paso: 0 })} />
            </View>
          </Card>
        ) : (
          <Button size="lg" icon={ClipboardPen} label="Empezar mi postulación" onPress={() => setForm({ datos: deCero(), paso: 0 })} style={{ alignSelf: 'flex-start' }} />
        )}
      </View>
    </>
  );
}

function Vacio({ icono: Icono, texto }: { icono: typeof UserRound; texto: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: 56, alignItems: 'center', gap: 16, maxWidth: 520, alignSelf: 'center' }}>
      <Icono size={26} color={colors.mutedForeground} />
      <Text color={colors.mutedForeground} style={{ textAlign: 'center', lineHeight: 21 }}>
        {texto}
      </Text>
    </View>
  );
}

function Cargando({ texto }: { texto: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: 56, alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={colors.primaryText} />
      <Text color={colors.mutedForeground}>{texto}</Text>
    </View>
  );
}

function ErrorCard({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  const { colors } = useTheme();
  return (
    <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
      <Text accessibilityRole="alert" color={colors.destructive} style={{ textAlign: 'center' }}>
        {mensaje}
      </Text>
      <Button variant="outline" icon={RefreshCw} label="Reintentar" onPress={onReintentar} />
    </Card>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    hero: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', padding: 20 },
    heroIcono: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
    pasos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pasoChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 30, borderRadius: 15, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
    acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  }),
);
