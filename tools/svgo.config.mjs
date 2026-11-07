/**
 * Pipeline SVGO do FitZero [CONT-02].
 * Mantém viewBox (o app escala o SVG por CSS), preserva as classes de animação
 * e as variáveis CSS (var(--accent)...), e não deixa nenhum <style>/<script>. As animações SMIL (<animate>) são mantidas.
 */
export default {
  multipass: true,
  floatPrecision: 1,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          removeViewBox: false,
          cleanupIds: false,
          // As polylines precisam continuar polylines: o atributo `points` é animado (SMIL)
          convertShapeToPath: false
        }
      }
    },
    'removeDimensions',
    'removeStyleElement',
    'removeScriptElement'
  ]
};
