// "Mis facturas": el facilitador sube la foto de su factura y carga el número, el timbrado, la
// fecha y el mes.
// Endpoints mis-facturas/* (sql/facturas_app_ethos.sql → PKG_FACTURAS_APP_ETHOS), con el
// ID_FACILITADOR sacado del token. Misma tabla que "Totales por Facilitador" del sitio
// editorial-ethos-app, donde el administrador la revisa.
// - Por revisar: se puede corregir o borrar. Revisada: solo se ve.
// - Nunca se muestran cantidad, sueldo ni monto (el backend no los devuelve).

import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { CircleCheck, Clock, ExternalLink, Pencil, Plus, Receipt, RefreshCw, Trash2 } from 'lucide-react-native';

import { useSession } from '../auth/session';
import { EditarFactura } from '../editar-factura';
import { eliminarFactura, esPdf, FALTA_PUBLICAR, faltaPublicar, isoADma, listarFacturas, miniatura, type Factura, type ListaFacturas } from '../facturas';
import { MESES, nombreMes } from '../fechas';
import { radius } from '../theme';
import { makeStyles, useTheme } from '../theme-provider';
import { useToast } from '../toast';
import { Badge, Button, Card, Modal, ModalActions, ModalText, PageTitle, Text, SinFacilitador } from '../ui';

type Resultado = { clave: string } & ({ tipo: 'error'; mensaje: string } | ({ tipo: 'listo' } & ListaFacturas));
/** Lo que se ve: la lista, o el formulario de una factura nueva (null) o de una a corregir. */
type Vista = { tipo: 'lista' } | { tipo: 'form'; factura: Factura | null };

export function FacturasScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const { facilitador, reintentarFacilitador } = useSession();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [intento, setIntento] = useState(0);
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  const [borrar, setBorrar] = useState<Factura | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [verFoto, setVerFoto] = useState<Factura | null>(null);

  // Sin ID_FACILITADOR no se piden datos: nunca se listan facturas "de todos".
  const id = facilitador.estado === 'listo' ? facilitador.id : null;
  const clave = `${id}-${intento}`;
  useEffect(() => {
    if (id === null) return;
    let vigente = true;
    listarFacturas()
      .then((r) => vigente && setResultado({ clave: `${id}-${intento}`, tipo: 'listo', ...r }))
      .catch((e: unknown) => vigente && setResultado({ clave: `${id}-${intento}`, tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudieron cargar tus facturas' }));
    return () => {
      vigente = false;
    };
  }, [id, intento]);

  const estado = resultado && resultado.clave === clave ? resultado : null;
  const recargar = () => {
    if (facilitador.estado === 'error') reintentarFacilitador();
    else setIntento((n) => n + 1);
  };

  const confirmarBorrado = async () => {
    if (!borrar) return;
    setBorrando(true);
    try {
      await eliminarFactura(borrar.id);
      toast.success('Factura borrada');
      setBorrar(null);
      recargar();
    } catch (e) {
      toast.error('No se pudo borrar la factura', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBorrando(false);
    }
  };

  if (vista.tipo === 'form' && estado?.tipo === 'listo') {
    return (
      <EditarFactura
        factura={vista.factura}
        facturas={estado.facturas}
        fotosHabilitadas={estado.fotosHabilitadas}
        onCancelar={() => setVista({ tipo: 'lista' })}
        onGuardada={() => {
          setVista({ tipo: 'lista' });
          recargar();
        }}
      />
    );
  }

  const encabezado = (
    <PageTitle title="Mis facturas" subtitle="Subí la foto de tu factura y sus datos para que la coordinación la revise.">
      <Button size="icon" variant="outline" icon={RefreshCw} accessibilityLabel="Actualizar facturas" onPress={recargar} disabled={facilitador.estado === 'cargando' || (id !== null && !estado)} />
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
        <SinFacilitador />
      </>
    );
  }

  return (
    <>
      {encabezado}

      {!estado && <Cargando texto="Cargando tus facturas…" />}

      {estado?.tipo === 'error' && <ErrorCard mensaje={faltaPublicar(estado.mensaje) ? FALTA_PUBLICAR : estado.mensaje} onReintentar={recargar} />}

      {estado?.tipo === 'listo' && (
        <>
          <Button icon={Plus} label="Cargar una factura" size="lg" onPress={() => setVista({ tipo: 'form', factura: null })} disabled={!estado.fotosHabilitadas} style={{ alignSelf: 'flex-start', marginBottom: 12 }} />
          {!estado.fotosHabilitadas && (
            <Text size={12} color={colors.mutedForeground} style={{ marginBottom: 16 }}>
              Todavía no se pueden subir fotos de facturas. Avisale a la coordinación.
            </Text>
          )}

          {estado.facturas.length === 0 ? (
            <View style={{ paddingVertical: 48, alignItems: 'center', gap: 14 }}>
              <Receipt size={24} color={colors.mutedForeground} />
              <Text color={colors.mutedForeground} style={{ textAlign: 'center' }}>
                Todavía no cargaste ninguna factura.
              </Text>
            </View>
          ) : (
            estado.facturas.map((f) => (
              <FacturaCard key={f.id} factura={f} onVer={() => setVerFoto(f)} onEditar={() => setVista({ tipo: 'form', factura: f })} onBorrar={() => setBorrar(f)} />
            ))
          )}
        </>
      )}

      {/* La foto en grande */}
      <Modal visible={verFoto !== null} onClose={() => setVerFoto(null)} title={verFoto ? `Factura ${verFoto.nroFactura}` : ''}>
        {verFoto?.fotoUrl ? (
          <View style={{ gap: 12 }}>
            <View style={{ height: 420, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.muted }}>
              <Image source={{ uri: miniatura(verFoto.fotoUrl, 1600) }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel={`Foto de la factura ${verFoto.nroFactura}`} />
            </View>
            <ModalActions>
              <Button variant="outline" icon={ExternalLink} label={esPdf(verFoto.fotoUrl) ? 'Abrir el PDF' : 'Abrir original'} onPress={() => void Linking.openURL(verFoto.fotoUrl)} />
              <Button label="Cerrar" onPress={() => setVerFoto(null)} />
            </ModalActions>
          </View>
        ) : null}
      </Modal>

      {/* Confirmar el borrado */}
      <Modal visible={borrar !== null} onClose={() => !borrando && setBorrar(null)} title="¿Borrar la factura?" closeLabel="Cancelar">
        {borrar && (
          <>
            <ModalText>
              Se borra la factura <ModalText strong>{borrar.nroFactura}</ModalText> de {MESES[borrar.mes - 1]} {borrar.anio}. Después podés volver a cargarla.
            </ModalText>
            <ModalActions>
              <Button variant="outline" label="Cancelar" onPress={() => setBorrar(null)} disabled={borrando} />
              <Button icon={Trash2} label={borrando ? 'Borrando…' : 'Borrar'} onPress={() => void confirmarBorrado()} disabled={borrando} style={{ backgroundColor: colors.destructive }} textStyle={{ color: colors.primaryForeground }} />
            </ModalActions>
          </>
        )}
      </Modal>
    </>
  );
}

function FacturaCard({ factura: f, onVer, onEditar, onBorrar }: { factura: Factura; onVer: () => void; onEditar: () => void; onBorrar: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Card style={s.card}>
      <View style={s.fila}>
        <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Ver la foto de la factura ${f.nroFactura}`} onPress={onVer} disabled={!f.fotoUrl} style={s.miniatura}>
          {f.fotoUrl ? <Image source={{ uri: miniatura(f.fotoUrl, 240) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Receipt size={22} color={colors.mutedForeground} />}
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={s.titulo}>
            <Text weight="bold" size={16}>
              {nombreMes(f.mes - 1)} {f.anio}
            </Text>
            {f.revisada ? <Badge tone="success" icon={CircleCheck} label="Revisada" /> : <Badge tone="accent" icon={Clock} label="Por revisar" />}
          </View>
          <Text size={13} weight="semibold">
            N.º {f.nroFactura}
          </Text>
          <Text size={12} color={colors.mutedForeground}>
            {f.timbrado ? `Timbrado ${f.timbrado} · ` : ''}Fecha {isoADma(f.fechaFactura)}
          </Text>
          {f.cargadoEl ? (
            <Text size={11} color={colors.mutedForeground}>
              Enviada el {isoADma(f.cargadoEl)}
            </Text>
          ) : null}
        </View>
      </View>

      {!f.revisada && (
        <View style={s.acciones}>
          <Button variant="outline" size="sm" icon={Pencil} label="Corregir" onPress={onEditar} />
          <Button variant="ghost" size="sm" icon={Trash2} label="Borrar" onPress={onBorrar} textStyle={{ color: colors.destructive }} />
        </View>
      )}
    </Card>
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
    card: { marginBottom: 12, maxWidth: 680 },
    fila: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
    miniatura: { width: 72, height: 92, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.muted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    titulo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
  }),
);
