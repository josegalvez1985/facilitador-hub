// "Mi postulación": el facilitador se postula para el año lectivo y actualiza sus datos.
// Endpoints mi-postulacion/* (sql/postulacion_app_ethos.sql → PKG_POSTULACION_APP_ETHOS), con el
// ID_FACILITADOR sacado del token. Una por año: si ya la envió, se ve el resumen y se puede corregir.
// - Sin enviar: se puede empezar con los datos de la postulación de otro año (o de cero).
// - Lo cargado y no enviado queda en memoria mientras la app está abierta (postulacion.ts).

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CalendarX2, CircleCheck, ClipboardPen, Copy, Pencil, RefreshCw, RotateCcw, UserRound } from 'lucide-react-native';

import { useSession } from '../auth/session';
import { FormularioPostulacion, Resumen } from '../postulacion-form';
import {
  borrarBorrador,
  cargarPostulacion,
  datosVacios,
  FALTA_PUBLICAR,
  faltaPublicar,
  guardarBorrador,
  isoADma,
  leerBorrador,
  PASOS,
  type Datos,
  type EstadoPostulacion,
} from '../postulacion';
import { radius } from '../theme';
import { makeStyles, useTheme } from '../theme-provider';
import { Badge, Button, Card, PageTitle, Text } from '../ui';

type Resultado = { clave: string } & ({ tipo: 'error'; mensaje: string } | { tipo: 'listo'; estado: EstadoPostulacion });
type Form = { datos: Datos; paso: number };

export function PostulacionScreen() {
  const { colors } = useTheme();
  const s = useStyles();
  const { sesion, facilitador, reintentarFacilitador } = useSession();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [intento, setIntento] = useState(0);
  const [form, setForm] = useState<Form | null>(null);

  // Sin ID_FACILITADOR no se piden datos.
  const id = facilitador.estado === 'listo' ? facilitador.id : null;
  const clave = `${id}-${intento}`;
  useEffect(() => {
    if (id === null) return;
    let vigente = true;
    cargarPostulacion()
      .then((estado) => vigente && setResultado({ clave: `${id}-${intento}`, tipo: 'listo', estado }))
      .catch((e: unknown) => vigente && setResultado({ clave: `${id}-${intento}`, tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo cargar tu postulación' }));
    return () => {
      vigente = false;
    };
  }, [id, intento]);

  const estado = resultado && resultado.clave === clave ? resultado : null;
  const recargar = () => {
    if (facilitador.estado === 'error') reintentarFacilitador();
    else setIntento((n) => n + 1);
  };

  const anio = estado?.tipo === 'listo' ? estado.estado.anio : '';
  const claveBorrador = `${sesion?.usuario ?? ''}-${anio}`;
  const onCambio = useCallback((datos: Datos, paso: number) => guardarBorrador(claveBorrador, datos, paso), [claveBorrador]);

  if (form && estado?.tipo === 'listo') {
    return (
      <FormularioPostulacion
        anio={anio}
        datosIniciales={form.datos}
        pasoInicial={form.paso}
        esCorreccion={estado.estado.postulacion !== null}
        onCambio={onCambio}
        onSalir={() => setForm(null)}
        onEnviada={() => {
          borrarBorrador();
          setForm(null);
          recargar();
        }}
      />
    );
  }

  const encabezado = (
    <PageTitle title="Mi postulación" subtitle="Postulate para el año lectivo y mantené tus datos al día.">
      <Button size="icon" variant="outline" icon={RefreshCw} accessibilityLabel="Actualizar" onPress={recargar} disabled={facilitador.estado === 'cargando' || (id !== null && !estado)} />
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
  if (id === null) {
    return (
      <>
        {encabezado}
        <Vacio icono={UserRound} texto={`Tu usuario ${sesion?.usuario ? `(${sesion.usuario}) ` : ''}no está registrado como facilitador.`} />
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
  if (!e.abierta) {
    return (
      <>
        {encabezado}
        <Vacio icono={CalendarX2} texto="En este momento no hay una postulación abierta. Cuando la coordinación la habilite, la vas a ver acá." />
      </>
    );
  }

  const borrador = leerBorrador(claveBorrador);

  // Ya enviada: el resumen y "Corregir".
  if (e.postulacion) {
    const p = e.postulacion;
    return (
      <>
        {encabezado}
        <View style={{ maxWidth: 720, width: '100%', gap: 16 }}>
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
                Si cambió algún dato, corregila cuando quieras.
              </Text>
            </View>
          </Card>
          <View style={s.acciones}>
            <Button icon={Pencil} label={borrador ? `Seguir corrigiendo (paso ${borrador.paso + 1})` : 'Corregir mi postulación'} onPress={() => setForm(borrador ? { datos: borrador.datos, paso: borrador.paso } : { datos: { ...p.datos, acepta_proceso: 'DE_ACUERDO' }, paso: 1 })} />
            {borrador && (
              <Button
                variant="outline"
                icon={RotateCcw}
                label="Descartar cambios"
                onPress={() => {
                  borrarBorrador();
                  setIntento((n) => n + 1);
                }}
              />
            )}
          </View>
          <Resumen datos={p.datos} lugar={{ departamento: p.departamento, ciudad: p.ciudad }} onEditar={(paso) => setForm({ datos: { ...p.datos, acepta_proceso: 'DE_ACUERDO' }, paso })} />
        </View>
      </>
    );
  }

  // Sin enviar: empezar (de cero, con los datos de otro año, o seguir el borrador).
  const deCero = (): Datos => {
    const d = datosVacios();
    d.nombre_completo = e.facilitador.nombre;
    d.telefono = e.facilitador.telefono;
    d.fecha_nacimiento = e.facilitador.fechaNacimiento;
    return d;
  };
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
            <Text size={13} color={colors.mutedForeground} style={{ lineHeight: 20 }}>
              Contale a la fundación que querés seguir como facilitador este año y actualizá tus datos. Son {PASOS.length - 1} pasos cortos y te lleva unos 10 minutos.
            </Text>
          </View>
        </Card>

        <View style={s.pasos}>
          {PASOS.slice(1, -1).map((p, i) => (
            <View key={p.id} style={s.pasoChip}>
              <Text size={11} weight="bold" color={colors.primaryText}>
                {i + 1}
              </Text>
              <Text size={12}>{p.titulo}</Text>
            </View>
          ))}
        </View>

        {borrador ? (
          <View style={s.acciones}>
            <Button size="lg" icon={Pencil} label={`Seguir donde dejaste (paso ${borrador.paso + 1})`} onPress={() => setForm({ datos: borrador.datos, paso: borrador.paso })} />
            <Button
              variant="outline"
              icon={RotateCcw}
              label="Empezar de nuevo"
              onPress={() => {
                borrarBorrador();
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
              <Button variant="outline" label="Empezar de cero" onPress={() => setForm({ datos: deCero(), paso: 0 })} />
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
