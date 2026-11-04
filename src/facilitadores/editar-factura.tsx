// Formulario de "Mis facturas": alta o corrección de una factura por revisar. Se cargan la foto
// (cámara o galería), el número, el timbrado, la fecha (elegida en un calendario) y el mes.
// La foto es obligatoria en el alta; en una corrección, sin foto nueva queda la que estaba.
// Las mismas validaciones que PKG_FACTURAS_APP_ETHOS.GUARDAR; el servidor las vuelve a hacer.
// Va dentro de la pantalla y no en un modal: el shell ya trae el KeyboardAvoidingView, así el
// teclado no tapa los campos en Android (edge-to-edge).

import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { ArrowLeft, Camera, ChevronLeft, ChevronRight, ImagePlus, Receipt } from 'lucide-react-native';

import {
  ANIO_MINIMO,
  aIso,
  formatearNroFactura,
  guardarFactura,
  LARGO_TIMBRADO,
  mascaraNroFactura,
  mesFuturo,
  mesSugerido,
  miniatura,
  subirFoto,
  tomarFoto,
  type Factura,
  type FotoLocal,
} from './facturas';
import { hoy, MESES, nombreMes } from './fechas';
import { ErrorDeCampo } from './intervenciones';
import { SelectorFecha } from './selector-fecha';
import { radius } from './theme';
import { makeStyles, useTheme } from './theme-provider';
import { useToast } from './toast';
import { Button, Card, Text } from './ui';

type Campo = 'foto_url' | 'mes' | 'nro_factura' | 'timbrado' | 'fecha_factura' | 'general';
type Errores = Partial<Record<Campo, string>>;
type Paso = 'listo' | 'subiendo' | 'guardando';

/** Los campos que el formulario muestra con su error al lado; el resto va abajo, en general. */
const CAMPOS: Record<string, true> = { foto_url: true, mes: true, nro_factura: true, timbrado: true, fecha_factura: true };

type Props = {
  /** null = factura nueva. */
  factura: Factura | null;
  /** Todas las del facilitador: para no ofrecer un mes que ya tiene factura. */
  facturas: Factura[];
  /** Si Cloudinary está configurado en Oracle. */
  fotosHabilitadas: boolean;
  onCancelar: () => void;
  onGuardada: () => void;
};

export function EditarFactura({ factura, facturas, fotosHabilitadas, onCancelar, onGuardada }: Props) {
  const { colors } = useTheme();
  const s = useStyles();
  const toast = useToast();
  const sugerido = factura ? { anio: factura.anio, mes: factura.mes } : mesSugerido(facturas);

  const [anio, setAnio] = useState(sugerido.anio);
  const [mes, setMes] = useState(sugerido.mes);
  const [nro, setNro] = useState(factura?.nroFactura ?? '');
  const [timbrado, setTimbrado] = useState(factura?.timbrado ?? '');
  const [fecha, setFecha] = useState(factura?.fechaFactura ?? aIso(hoy()));
  const [errores, setErrores] = useState<Errores>({});
  const [paso, setPaso] = useState<Paso>('listo');
  const [foto, setFoto] = useState<FotoLocal | null>(null);
  // La foto ya subida a Cloudinary: si el guardado falla (p. ej. mes repetido), no se vuelve a subir.
  const [subida, setSubida] = useState<{ uri: string; url: string } | null>(null);
  const [eligiendo, setEligiendo] = useState(false);

  const guardando = paso !== 'listo';
  const fotoActual = factura?.fotoUrl ?? '';
  const vistaPrevia = foto?.uri ?? (fotoActual ? miniatura(fotoActual, 900) : null);
  const puedeElegirFoto = fotosHabilitadas && !guardando && !eligiendo;
  const anioActual = hoy().getFullYear();
  const limpiar = (c: Campo) => setErrores((e) => ({ ...e, [c]: undefined, general: undefined }));
  // El mes ocupado por OTRA factura del facilitador (la que se corrige no cuenta).
  const facturaDelMes = (a: number, m: number) => facturas.find((f) => f.anio === a && f.mes === m && f.id !== factura?.id);

  const elegir = async (origen: 'camara' | 'galeria') => {
    setEligiendo(true);
    try {
      const f = await tomarFoto(origen);
      if (f) {
        setFoto(f);
        limpiar('foto_url');
      }
    } catch (err) {
      setErrores((x) => ({ ...x, foto_url: err instanceof Error ? err.message : 'No se pudo abrir la foto.' }));
    } finally {
      setEligiendo(false);
    }
  };

  const guardar = async () => {
    const e: Errores = {};
    const nroFormateado = formatearNroFactura(nro);
    const timbradoLimpio = timbrado.replace(/\s+/g, '');
    const otra = facturaDelMes(anio, mes);
    if (!foto && !fotoActual) e.foto_url = fotosHabilitadas ? 'Sacá o elegí la foto de la factura.' : 'Todavía no se pueden subir fotos. Avisale a la coordinación.';
    if (mesFuturo(anio, mes)) e.mes = 'Ese mes todavía no empezó.';
    else if (otra) e.mes = `Ya cargaste una factura de ${MESES[mes - 1]} ${anio} (la ${otra.nroFactura}).`;
    if (!nro.trim()) e.nro_factura = 'Escribí el número de la factura.';
    else if (!nroFormateado) e.nro_factura = 'El número va con el formato 001-001-0000123.';
    if (timbradoLimpio && !/^\d+$/.test(timbradoLimpio)) e.timbrado = 'El timbrado lleva solo números.';
    if (!fecha) e.fecha_factura = 'Elegí la fecha de la factura.';
    else if (fecha > aIso(hoy())) e.fecha_factura = 'La fecha no puede ser posterior a hoy.';
    setErrores(e);
    if (Object.keys(e).length || !nroFormateado) return;
    setNro(nroFormateado);

    try {
      // Una foto nueva se sube recién ahora: la firma de Cloudinary vence en una hora.
      let url = '';
      if (foto) {
        if (subida?.uri === foto.uri) url = subida.url;
        else {
          setPaso('subiendo');
          url = await subirFoto(foto);
          setSubida({ uri: foto.uri, url });
        }
      }
      setPaso('guardando');
      await guardarFactura(factura?.id ?? null, { nro_factura: nroFormateado, timbrado: timbradoLimpio, fecha_factura: fecha, anio, mes, foto_url: url });
      toast.success(factura ? 'Factura actualizada' : 'Factura enviada');
      onGuardada();
    } catch (err) {
      if (err instanceof ErrorDeCampo && err.campo) {
        // El servidor no aceptó el enlace: la próxima vez se vuelve a subir.
        if (err.campo === 'foto_url') setSubida(null);
        setErrores({ [err.campo in CAMPOS ? err.campo : 'general']: err.message });
      } else setErrores({ general: err instanceof Error ? err.message : 'No se pudo guardar la factura.' });
    } finally {
      setPaso('listo');
    }
  };

  return (
    <View style={{ gap: 16, maxWidth: 680, width: '100%' }}>
      <View style={s.encabezado}>
        <Button variant="ghost" size="icon" icon={ArrowLeft} accessibilityLabel="Volver a mis facturas" onPress={onCancelar} disabled={guardando} />
        <View style={{ flex: 1 }}>
          <Text weight="bold" size={20}>
            {factura ? 'Corregir factura' : 'Nueva factura'}
          </Text>
          <Text size={12} color={colors.mutedForeground} style={{ marginTop: 2 }}>
            Los campos con * son obligatorios.
          </Text>
        </View>
      </View>

      {/* La foto de la factura */}
      <Card style={{ gap: 12 }}>
        <Etiqueta texto="Foto de la factura" requerido={!factura} />
        <View style={[s.foto, errores.foto_url ? { borderColor: colors.destructive } : null]}>
          {vistaPrevia ? (
            <Image source={{ uri: vistaPrevia }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel="Foto de la factura" />
          ) : (
            <View style={{ alignItems: 'center', gap: 10, padding: 20 }}>
              <Receipt size={28} color={colors.mutedForeground} />
              <Text size={12} color={colors.mutedForeground} style={{ textAlign: 'center', lineHeight: 18 }}>
                Sacale una foto a la factura entera, con buena luz y sin reflejos, de modo que se lean el número, el timbrado y la fecha.
              </Text>
            </View>
          )}
          {eligiendo && (
            <View style={s.fotoCargando}>
              <ActivityIndicator color={colors.primaryText} />
            </View>
          )}
        </View>
        {fotosHabilitadas ? (
          <View style={s.botonesFoto}>
            <Button icon={Camera} label={vistaPrevia ? 'Sacar otra' : 'Sacar foto'} onPress={() => void elegir('camara')} disabled={!puedeElegirFoto} style={{ flexGrow: 1 }} />
            <Button variant="outline" icon={ImagePlus} label="Elegir de la galería" onPress={() => void elegir('galeria')} disabled={!puedeElegirFoto} style={{ flexGrow: 1 }} />
          </View>
        ) : (
          <Text size={12} color={colors.mutedForeground}>
            Todavía no se pueden subir fotos. Avisale a la coordinación.
          </Text>
        )}
        {factura && !foto && fotoActual ? (
          <Text size={11} color={colors.mutedForeground}>
            Si no cambiás la foto, queda la que ya enviaste.
          </Text>
        ) : null}
        <ErrorCampo texto={errores.foto_url} />
      </Card>

      <Card style={{ gap: 18 }}>
        <View>
          <Etiqueta texto="Número de factura" requerido />
          <TextInput
            value={nro}
            onChangeText={(t) => {
              setNro(mascaraNroFactura(t));
              limpiar('nro_factura');
            }}
            onBlur={() => {
              const f = formatearNroFactura(nro);
              if (f) setNro(f);
            }}
            placeholder="001-001-0000123"
            placeholderTextColor={colors.mutedForeground}
            keyboardAppearance={colors.scheme}
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'phone-pad'}
            autoCorrect={false}
            maxLength={15}
            editable={!guardando}
            style={[s.input, errores.nro_factura ? { borderColor: colors.destructive } : null]}
            accessibilityLabel="Número de factura"
          />
          <Text size={11} color={colors.mutedForeground} style={{ marginTop: 6 }}>
            Como figura arriba a la derecha de la factura. Escribilo con o sin guiones: se ponen solos.
          </Text>
          <ErrorCampo texto={errores.nro_factura} />
        </View>

        <View>
          <Etiqueta texto="Timbrado" />
          <TextInput
            value={timbrado}
            onChangeText={(t) => {
              setTimbrado(t.replace(/\D/g, ''));
              limpiar('timbrado');
            }}
            placeholder="12345678"
            placeholderTextColor={colors.mutedForeground}
            keyboardAppearance={colors.scheme}
            keyboardType="number-pad"
            maxLength={LARGO_TIMBRADO}
            editable={!guardando}
            style={[s.input, errores.timbrado ? { borderColor: colors.destructive } : null]}
            accessibilityLabel="Timbrado"
          />
          <ErrorCampo texto={errores.timbrado} />
        </View>

        <View>
          <Etiqueta texto="Fecha de la factura" requerido />
          <SelectorFecha
            titulo="Fecha de la factura"
            valor={fecha}
            minimo={`${ANIO_MINIMO}-01-01`}
            maximo={aIso(hoy())}
            error={!!errores.fecha_factura}
            disabled={guardando}
            onCambiar={(iso) => {
              setFecha(iso);
              limpiar('fecha_factura');
            }}
          />
          <ErrorCampo texto={errores.fecha_factura} />
        </View>

        <View>
          <Etiqueta texto="Mes que cubre la factura" requerido />
          <View style={s.anio}>
            <Button
              variant="outline"
              size="icon"
              icon={ChevronLeft}
              accessibilityLabel="Año anterior"
              disabled={anio <= ANIO_MINIMO || guardando}
              onPress={() => {
                setAnio(anio - 1);
                limpiar('mes');
              }}
            />
            <Text weight="bold" size={16} style={{ minWidth: 60, textAlign: 'center' }} accessibilityLabel={`Año ${anio}`}>
              {anio}
            </Text>
            <Button
              variant="outline"
              size="icon"
              icon={ChevronRight}
              accessibilityLabel="Año siguiente"
              disabled={anio >= anioActual || guardando}
              onPress={() => {
                setAnio(anio + 1);
                limpiar('mes');
              }}
            />
          </View>
          <View style={s.meses}>
            {MESES.map((nombre, i) => {
              const m = i + 1;
              const sel = m === mes;
              const futuro = mesFuturo(anio, m);
              const ocupadoPor = facturaDelMes(anio, m);
              const bloqueado = futuro || !!ocupadoPor;
              return (
                <Pressable
                  key={nombre}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: sel, disabled: bloqueado }}
                  accessibilityLabel={`${nombreMes(i)} ${anio}${ocupadoPor ? ', ya tiene factura' : futuro ? ', todavía no empezó' : ''}`}
                  disabled={bloqueado || guardando}
                  onPress={() => {
                    setMes(m);
                    limpiar('mes');
                  }}
                  style={[s.mes, sel && !bloqueado && { backgroundColor: colors.primary, borderColor: colors.primary }, bloqueado && { opacity: 0.45 }]}
                >
                  <Text size={12} weight={sel ? 'bold' : 'medium'} color={sel && !bloqueado ? colors.primaryForeground : colors.foreground}>
                    {nombreMes(i).slice(0, 3)}
                  </Text>
                  {ocupadoPor ? (
                    <Text size={9} color={colors.mutedForeground}>
                      cargada
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Text size={11} color={colors.mutedForeground} style={{ marginTop: 8 }}>
            Del 1 al {new Date(anio, mes, 0).getDate()} de {MESES[mes - 1]} de {anio}. Una factura por mes.
          </Text>
          <ErrorCampo texto={errores.mes} />
        </View>
      </Card>

      <Text size={12} color={colors.mutedForeground} style={{ lineHeight: 18 }}>
        Después de enviarla, la coordinación la revisa. Mientras esté <Text size={12} weight="semibold">por revisar</Text> podés corregirla o borrarla.
      </Text>

      {errores.general && (
        <Text accessibilityRole="alert" color={colors.destructive}>
          {errores.general}
        </Text>
      )}

      <View style={s.acciones}>
        <Button variant="outline" label="Cancelar" onPress={onCancelar} disabled={guardando} />
        <Button
          label={paso === 'subiendo' ? 'Subiendo la foto…' : paso === 'guardando' ? 'Enviando…' : factura ? 'Guardar cambios' : 'Enviar factura'}
          onPress={() => void guardar()}
          disabled={guardando || eligiendo}
        />
      </View>
    </View>
  );
}

function Etiqueta({ texto, requerido }: { texto: string; requerido?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text weight="semibold" size={12} style={{ marginBottom: 8 }}>
      {texto}
      {requerido && <Text color={colors.destructive}> *</Text>}
    </Text>
  );
}

function ErrorCampo({ texto }: { texto?: string }) {
  const { colors } = useTheme();
  if (!texto) return null;
  return (
    <Text accessibilityRole="alert" size={12} color={colors.destructive} style={{ marginTop: 6 }}>
      {texto}
    </Text>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    encabezado: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    foto: { height: 280, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, borderRadius: radius.lg, backgroundColor: c.muted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    fotoCargando: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: c.overlay },
    botonesFoto: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    anio: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    meses: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    mes: { width: 64, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.background, paddingVertical: 4 },
    input: { minHeight: 46, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: 12, color: c.foreground, backgroundColor: c.card, fontSize: 16 },
    acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' },
  }),
);
