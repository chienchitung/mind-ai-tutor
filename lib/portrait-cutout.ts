// Optional on-device processing. Only model/runtime files are downloaded;
// neither the photo nor segmentation results are sent to an external service.
export async function removePortraitBackground(source: ImageBitmap): Promise<ImageBitmap> {
  const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
  const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
  const segmenter = await ImageSegmenter.createFromOptions(files, {
    baseOptions: { modelAssetPath: '/models/selfie-segmenter.tflite', delegate: 'CPU' },
    runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false,
  });
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1024 / Math.max(source.width, source.height));
    canvas.width = Math.round(source.width * scale); canvas.height = Math.round(source.height * scale);
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('CUTOUT_FAILED');
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const result = segmenter.segment(canvas);
    try {
      // The official selfie model has one foreground confidence mask. Some
      // model versions expose background+person; use the person mask then.
      const masks = result.confidenceMasks;
      const mask = masks?.[masks.length > 1 ? 1 : 0];
      if (!mask) throw new Error('CUTOUT_FAILED');
      const pixels = mask.getAsFloat32Array();
      const alphaCanvas = document.createElement('canvas'); alphaCanvas.width = mask.width; alphaCanvas.height = mask.height;
      const alphaCtx = alphaCanvas.getContext('2d'); if (!alphaCtx) throw new Error('CUTOUT_FAILED');
      const rgba = alphaCtx.createImageData(mask.width, mask.height); let foreground = 0;
      for (let i = 0; i < pixels.length; i++) {
        const value = Math.max(0, Math.min(1, (pixels[i] - 0.15) / 0.7));
        rgba.data[i * 4 + 3] = Math.round(value * 255); foreground += value;
      }
      if (foreground / pixels.length < 0.01) throw new Error('NO_PERSON');
      alphaCtx.putImageData(rgba, 0, 0);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(alphaCanvas, 0, 0, canvas.width, canvas.height);
      return await createImageBitmap(canvas);
    } finally { result.close(); }
  } finally { segmenter.close(); }
}
