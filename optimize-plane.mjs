import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, prune, weld, draco, textureCompress } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

async function optimize() {
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression, EXTTextureWebP])
    .registerDependencies({
      'draco3d.encoder': await draco3d.createEncoderModule(),
      'draco3d.decoder': await draco3d.createDecoderModule(),
    });

  console.log('Reading scripts/_originals/plane.glb...');
  const document = await io.read('scripts/_originals/plane.glb');

  console.log('Applying dedup, prune, weld, textureCompress, draco...');
  await document.transform(
    weld(),
    dedup(),
    prune(),
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [1024, 1024],
    }),
    draco({
      compressionLevel: 7,
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
      quantizeColor: 8,
      quantizeGeneric: 12,
    })
  );

  console.log('Writing scripts/_originals/plane-transformed.glb...');
  const glb = await io.writeBinary(document);
  fs.writeFileSync('scripts/_originals/plane-transformed.glb', Buffer.from(glb));
  console.log('Done! Size:', (glb.byteLength / 1024 / 1024).toFixed(2), 'MB (', glb.byteLength, 'bytes)');
}

optimize().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
