import { View } from 'react-native';
import { CheckCheck, MapPin, Navigation } from 'lucide-react-native';

import { lessons } from './data';
import { useApp } from './provider';
import { Button, Modal, ModalActions, ModalText, Notice, StatIcon } from './ui';

export function MarkModal() {
  const app = useApp();
  const lesson = lessons[0];
  const close = () => app.setMarkOpen(false);
  if (!lesson) return null;
  return (
    <Modal visible={app.markOpen} onClose={close} title={app.marked ? '¡Entrada registrada!' : 'Registrar entrada'} label="Registrar marcación">
      <View style={{ marginVertical: 14 }}>
        <StatIcon icon={app.marked ? CheckCheck : Navigation} tone="success" />
      </View>
      <ModalText strong>{lesson.title.replace(/ · .*/, '')} · {lesson.grade}</ModalText>
      <ModalText>
        {lesson.school}
        {'\n'}
        {lesson.time}
      </ModalText>
      <Notice>
        Ubicación de ejemplo · Asunción, Paraguay{'\n'}Marcación de demostración; no se guardará una ubicación real.
      </Notice>
      <ModalActions>
        <Button variant="outline" label="Cerrar" onPress={close} />
        {!app.marked && <Button icon={MapPin} label="Confirmar entrada" onPress={() => app.setMarked(true)} />}
      </ModalActions>
    </Modal>
  );
}
