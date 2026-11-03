import { env, pipeline } from '../node_modules/@huggingface/transformers/dist/transformers.min.js';

let upscalerPromise;

export async function upscaleArtwork(dataUrl) {
    if (!upscalerPromise) {
        env.useBrowserCache = true;
        env.backends.onnx.wasm.wasmPaths = new URL('../node_modules/onnxruntime-web/dist/', import.meta.url).href;
        upscalerPromise = pipeline('image-to-image', 'Xenova/swin2SR-classical-sr-x2-64');
    }
    const upscaler = await upscalerPromise;
    const image = await upscaler(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { alpha: false });
    const pixels = context.createImageData(image.width, image.height);
    if (image.channels === 4) {
        pixels.data.set(image.data);
    } else {
        for (let input = 0, output = 0; input < image.data.length; input += image.channels, output += 4) {
            pixels.data[output] = image.data[input];
            pixels.data[output + 1] = image.data[input + 1];
            pixels.data[output + 2] = image.data[input + 2];
            pixels.data[output + 3] = 255;
        }
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL('image/png');
}
