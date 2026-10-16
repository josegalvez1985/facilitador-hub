// Página 8 "Observación" de APEX 193573: editar una intervención (índice, ¿desarrolló?,
// motivo y observación). Se abre como hoja sobre Historial e Intervenciones realizadas.
// - MANUAL es solo lectura; el índice sale de los índices de ese manual.
// - El motivo se muestra solo con "No" pero, como en APEX, se guarda el valor que tenga.
// - Validación OBS: con "No" + "Otros" la observación es obligatoria.

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Check, Search, X } from 'lucide-react-native';

import { cargarFormIntervencion, guardarCambiosIntervencion, type FormIntervencion } from './historial';
import { COLOR_MANUAL, ErrorDeCampo } from './intervenciones';
import { alpha, radius } from './theme';
import { makeStyles, useTheme } from './theme-provider';
import { useToast } from './toast';
import { Button, Modal, ModalActions, Text } from './ui';

type Errores = Partial<Record<'id_indice' | 'si_no' | 'motivo_desarrollo' | 'observacion' | 'general', string>>;

/** `id` null = cerrada. `onGuardada` se llama después de guardar (para refrescar la lista, como APEX). */
export function EditarIntervencion({ id, onClose, onGuardada }: { id: number | null; onClose: () => void; onGuardada: () => void }) {
  return (
    <Modal visible={id !== null} onClose={onClose} title="Editar intervención" closeLabel="Cancelar">
      {id !== null && <Formulario key={id} id={id} onClose={onClose} onGuardada={onGuardada} />}
    </Modal>
  );
}

function Formulario({ id, onClose, onGuardada }: { id: number; onClose: () => void; onGuardada: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  const toast = useToast();
  const [form, setForm] = useState<FormIntervencion | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [idIndice, setIdIndice] = useState<number | null>(null);
  const [siNo, setSiNo] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [observacion, setObservacion] = useState('');
  const [buscar, setBuscar] = useState('');
  const [verIndices, setVerIndices] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    cargarFormIntervencion(id)
      .then((f) => {
        if (!vigente) return;
        setForm(f);
        setErrorCarga(null);
        setIdIndice(f.idIndice);
        setSiNo(f.siNo);
        setMotivo(f.motivo);
        setObservacion(f.observacion);
      })
      .catch((e: unknown) => vigente && setErrorCarga(e instanceof Error ? e.message : 'No se pudo abrir la intervención'));
    return () => {
      vigente = false;
    };
  }, [id, intento]);

  if (errorCarga) {
    return (
      <View style={{ gap: 12 }}>
        <Text accessibilityRole="alert" color={colors.destructive}>
          {/not found/i.test(errorCarga) && !/intervenci/i.test(errorCarga) ? 'Falta publicar en el backend los endpoints de historial-intervenciones (sql/historial_app_ethos.sql).' : errorCarga}
        </Text>
        <ModalActions>
          <Button variant="outline" label="Cerrar" onPress={onClose} />
          <Button label="Reintentar" onPress={() => setIntento((n) => n + 1)} />
        </ModalActions>
      </View>
    );
  }
  if (!form) {
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center', gap: 10 }}>
        <ActivityIndicator color={colors.primaryText} />
        <Text color={colors.mutedForeground}>Cargando la intervención…</Text>
      </View>
    );
  }

  const color = COLOR_MANUAL[form.manual] ?? colors.primary;
  const indice = form.indices.find((i) => i.id === idIndice);
  const filtro = buscar.trim().toLowerCase();
  const indices = filtro ? form.indices.filter((i) => i.titulo.toLowerCase().includes(filtro)) : form.indices;
  const obsObligatoria = (siNo ?? 'No') === 'No' && motivo === 'Otros';

  const guardar = async () => {
    // Mismas reglas que la página (el servidor las vuelve a validar).
    const e: Errores = {};
    if (idIndice === null) e.id_indice = 'Elegí el índice del manual.';
    if (!siNo) e.si_no = 'Indicá si se desarrolló la clase.';
    if (obsObligatoria && !observacion.trim()) e.observacion = 'Debe cargar una observación para guardar';
    setErrores(e);
    if (Object.keys(e).length) return;
    setGuardando(true);
    try {
      await guardarCambiosIntervencion(id, { id_indice: idIndice, si_no: siNo, motivo_desarrollo: motivo, observacion: observacion.trim() });
      toast.success('Intervención actualizada');
      onGuardada();
      onClose();
    } catch (err) {
      if (err instanceof ErrorDeCampo && err.campo) setErrores({ [err.campo]: err.message });
      else setErrores({ general: err instanceof Error ? err.message : 'No se pudo guardar' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
      {/* Manual (solo lectura) */}
      <View style={[s.manual, { backgroundColor: alpha(color, colors.scheme === 'dark' ? 0.25 : 0.14), borderLeftColor: color }]}>
        <Text size={11} color={colors.mutedForeground}>
          Manual
        </Text>
        <Text weight="extrabold" size={15}>
          {form.manual || '—'}
        </Text>
      </View>

      {/* Índice (P8_ID_INDICE, requerido) */}
      <View>
        <Etiqueta texto="Intervención (índice)" requerido />
        <Pressable accessibilityRole="button" accessibilityLabel="Cambiar índice" onPress={() => setVerIndices(!verIndices)} style={[s.select, errores.id_indice ? { borderColor: colors.destructive } : null]}>
          <Text size={14} weight={indice ? 'semibold' : 'regular'} color={indice ? colors.foreground : colors.mutedForeground} style={{ flex: 1 }}>
            {indice?.titulo ?? 'Elegí un índice'}
          </Text>
          <Text size={12} weight="semibold" color={colors.primaryText}>
            {verIndices ? 'Cerrar' : 'Cambiar'}
          </Text>
        </Pressable>
        {verIndices && (
          <View style={s.lista}>
            {form.indices.length > 8 && (
              <View style={s.buscar}>
                <Search size={14} color={colors.mutedForeground} />
                <TextInput value={buscar} onChangeText={setBuscar} placeholder="Buscar índice" placeholderTextColor={colors.mutedForeground} style={s.buscarInput} accessibilityLabel="Buscar índice" />
              </View>
            )}
            <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {indices.map((i) => {
                const sel = i.id === idIndice;
                return (
                  <Pressable
                    key={i.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: sel }}
                    onPress={() => {
                      setIdIndice(i.id);
                      setVerIndices(false);
                      setErrores((e) => ({ ...e, id_indice: undefined }));
                    }}
                    style={[s.opcion, sel && { backgroundColor: colors.secondary }]}
                  >
                    <Text size={13} weight={sel ? 'bold' : 'regular'} style={{ flex: 1 }}>
                      {i.titulo}
                    </Text>
                    {sel && <Check size={14} color={colors.primaryText} />}
                  </Pressable>
                );
              })}
              {!indices.length && (
                <Text size={12} color={colors.mutedForeground} style={{ padding: 10 }}>
                  Ningún índice coincide.
                </Text>
              )}
            </ScrollView>
          </View>
        )}
        <ErrorCampo texto={errores.id_indice} />
      </View>

      {/* ¿Desarrolló? (P8_SI_NO, requerido) */}
      <View>
        <Etiqueta texto="¿Desarrolló la clase?" requerido />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {(['Si', 'No'] as const).map((v) => {
            const sel = siNo === v;
            const tono = v === 'Si' ? colors.success : colors.accent;
            return (
              <Pressable
                key={v}
                accessibilityRole="radio"
                accessibilityState={{ checked: sel }}
                accessibilityLabel={v === 'Si' ? 'Sí' : 'No'}
                onPress={() => {
                  setSiNo(v);
                  setErrores((e) => ({ ...e, si_no: undefined }));
                }}
                style={[s.sino, sel && { backgroundColor: tono, borderColor: tono }]}
              >
                {v === 'Si' ? <Check size={16} color={sel ? colors.primaryForeground : colors.mutedForeground} /> : <X size={16} color={sel ? colors.primaryForeground : colors.mutedForeground} />}
                <Text weight="bold" color={sel ? colors.primaryForeground : colors.foreground}>
                  {v === 'Si' ? 'Sí' : 'No'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <ErrorCampo texto={errores.si_no} />
      </View>

      {/* Motivo (P8_MOTIVO_DESARROLLO): visible solo con "No" */}
      {siNo === 'No' && (
        <View>
          <Etiqueta texto="Motivo" />
          <View style={s.chips}>
            {form.motivos.map((m) => {
              const sel = motivo === m;
              return (
                <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: sel }} onPress={() => setMotivo(sel ? null : m)} style={[s.chip, sel && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  <Text size={12} weight={sel ? 'bold' : 'medium'} color={sel ? colors.primaryForeground : colors.foreground}>
                    {m}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <ErrorCampo texto={errores.motivo_desarrollo} />
        </View>
      )}

      {/* Observación (P8_OBSERVACION, hasta 1000) */}
      <View>
        <Etiqueta texto="Observación" requerido={obsObligatoria} />
        <TextInput
          value={observacion}
          onChangeText={(t) => {
            setObservacion(t);
            setErrores((e) => ({ ...e, observacion: undefined }));
          }}
          placeholder={obsObligatoria ? 'Contá el motivo (obligatorio con "Otros")' : 'Contá cómo fue la clase (opcional)'}
          placeholderTextColor={colors.mutedForeground}
          keyboardAppearance={colors.scheme}
          multiline
          maxLength={1000}
          style={[s.textarea, errores.observacion ? { borderColor: colors.destructive } : null]}
          accessibilityLabel="Observación"
        />
        <Text size={10} color={colors.mutedForeground} style={{ textAlign: 'right', marginTop: 4 }}>
          {observacion.length}/1000
        </Text>
        <ErrorCampo texto={errores.observacion} />
      </View>

      {errores.general && (
        <Text accessibilityRole="alert" color={colors.destructive}>
          {errores.general}
        </Text>
      )}

      <ModalActions>
        <Button variant="outline" label="Cancelar" onPress={onClose} />
        <Button label={guardando ? 'Guardando…' : 'Aplicar cambios'} onPress={() => void guardar()} disabled={guardando} />
      </ModalActions>
    </ScrollView>
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
    manual: { borderLeftWidth: 4, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
    select: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.card },
    lista: { marginTop: 6, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.card, overflow: 'hidden' },
    buscar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: c.border },
    buscarInput: { flex: 1, minHeight: 40, color: c.foreground, fontSize: 14 },
    opcion: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
    sino: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, backgroundColor: c.card },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { minHeight: 34, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderColor: c.border, backgroundColor: c.background },
    textarea: { minHeight: 110, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: 12, color: c.foreground, backgroundColor: c.card, textAlignVertical: 'top', fontSize: 16 },
  }),
);
