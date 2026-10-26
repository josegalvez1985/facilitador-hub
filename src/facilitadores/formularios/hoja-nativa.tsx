// La hoja de un formulario en el APK: un WebView con el dibujo como SVG. Muestra la vista previa
// (se amplía pellizcando) y genera la imagen PNG con un <canvas> adentro del WebView.
//
// No se usa Svg.toDataURL de react-native-svg: en Android dibuja y comprime el PNG en el hilo
// principal, y con una hoja de ~2800 px la app quedaba "no responde". El WebView trabaja en su
// propio proceso, y la imagen sale igual que en la web.

import { useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { Lamina } from './pintor';
import { pixelesImagen } from './salida';
import { svgMarkup, tamanoLamina } from './vista';

/** Lo que la pantalla le pide a la hoja: la imagen PNG en base64. */
export type HojaNativaRef = { rasterizar(): Promise<string> };

type Pedido = { ok: (base64: string) => void; mal: (e: Error) => void };

function html(lamina: Lamina) {
  const { ancho, alto } = pixelesImagen(lamina);
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=8, user-scalable=yes">
<style>html,body{margin:0;padding:0;background:#fff}svg{display:block;width:100%;height:auto}</style></head>
<body>${svgMarkup(lamina, ancho, alto)}<script>
var SVG = document.querySelector('svg').outerHTML;
function avisar(m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
window.rasterizar = function (id) {
  var img = new Image();
  img.onload = function () {
    try {
      var c = document.createElement('canvas');
      c.width = ${ancho};
      c.height = ${alto};
      c.getContext('2d').drawImage(img, 0, 0, ${ancho}, ${alto});
      avisar({ id: id, base64: c.toDataURL('image/png').split(',')[1] });
    } catch (e) {
      avisar({ id: id, error: String(e) });
    }
  };
  img.onerror = function () { avisar({ id: id, error: 'No se pudo dibujar la imagen' }); };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SVG);
};
</script></body></html>`;
}

export function HojaNativa({ lamina, ancho, ref }: { lamina: Lamina; ancho: number; ref?: Ref<HojaNativaRef> }) {
  const web = useRef<WebView>(null);
  const pedidos = useRef(new Map<number, Pedido>());
  const siguiente = useRef(1);
  // Memo: si cambia el estado de la pantalla, el WebView no se vuelve a cargar.
  const source = useMemo(() => ({ html: html(lamina), baseUrl: '' }), [lamina]);
  const t = tamanoLamina(lamina);

  useImperativeHandle(ref, () => ({
    rasterizar: () =>
      new Promise<string>((ok, mal) => {
        if (!web.current) return mal(new Error('La vista previa todavía no está lista'));
        const id = siguiente.current++;
        pedidos.current.set(id, { ok, mal });
        web.current.injectJavaScript(`window.rasterizar && window.rasterizar(${id}); true;`);
      }),
  }));

  const recibir = (e: WebViewMessageEvent) => {
    let m: { id?: number; base64?: string; error?: string };
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    const p = m.id == null ? undefined : pedidos.current.get(m.id);
    if (!p || m.id == null) return;
    pedidos.current.delete(m.id);
    if (m.base64) p.ok(m.base64);
    else p.mal(new Error(m.error ?? 'No se pudo generar la imagen'));
  };

  // Si el proceso del WebView se cae (poca memoria), los pedidos pendientes fallan en vez de quedar colgados.
  const fallar = () => {
    for (const p of pedidos.current.values()) p.mal(new Error('No se pudo generar la imagen'));
    pedidos.current.clear();
  };

  return (
    <WebView
      ref={web}
      source={source}
      originWhitelist={['*']}
      onMessage={recibir}
      onRenderProcessGone={fallar}
      onContentProcessDidTerminate={fallar}
      style={{ width: ancho, height: (ancho * t.alto) / t.ancho, backgroundColor: 'transparent' }}
      scalesPageToFit
      setBuiltInZoomControls
      setDisplayZoomControls={false}
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
    />
  );
}
