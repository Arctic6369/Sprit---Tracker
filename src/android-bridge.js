import { App } from '@capacitor/app';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';

const CAMERA_KIND = 'pending_ocr_kind';
const photoOptions = {
  resultType: CameraResultType.Uri,
  source: CameraSource.Prompt,
  promptLabelHeader: 'Bild für Texterkennung',
  promptLabelPhoto: 'Aus Fotos wählen',
  promptLabelPicture: 'Foto aufnehmen',
  quality: 90,
  width: 2400,
  height: 2400,
  saveToGallery: false,
};

if (Capacitor.getPlatform() === 'android') {
  globalThis.spritAndroid = {
    async read(key) {
      return (await Preferences.get({ key })).value;
    },
    async write(key, value) {
      await Preferences.set({ key, value });
    },
    async photo(kind) {
      await Preferences.set({ key: CAMERA_KIND, value: kind });
      try {
        return (await Camera.getPhoto(photoOptions)).webPath;
      } finally {
        await Preferences.remove({ key: CAMERA_KIND });
      }
    },
    async onRestoredPhoto(scan) {
      await App.addListener('appRestoredResult', async result => {
        if (result.pluginId !== 'Camera' || result.methodName !== 'getPhoto') return;
        const { value: kind } = await Preferences.get({ key: CAMERA_KIND });
        await Preferences.remove({ key: CAMERA_KIND });
        if (result.success && result.data?.webPath && ['receipt', 'tach'].includes(kind)) {
          await scan(result.data.webPath, kind);
        }
      });
    },
    async exportFile(name, data) {
      const path = 'exports/' + crypto.randomUUID() + '/' + name;
      const { uri } = await Filesystem.writeFile({
        path, data, directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true,
      });
      await Share.share({ files: [uri], dialogTitle: 'Sprit-Tracker Export' });
    },
    ocr: {
      workerPath: './ocr/worker.min.js',
      corePath: './ocr',
      langPath: new URL('./ocr/', document.baseURI).href,
      workerBlobURL: false,
    },
  };
}
