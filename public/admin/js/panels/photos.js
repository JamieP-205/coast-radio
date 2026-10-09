// Photos. Photos from phones and cameras are often huge, so they're made
// smaller here before they're sent.

import { api } from '../api.js';
import { change, content, defaults } from '../draft.js';
import { showInPreview } from '../preview.js';

const PHOTO_LONGEST_SIDE = 1600;
const PHOTO_PAGES = { studio: 'home', about: 'about' };

function shrinkPhoto(file) {
  return createImageBitmap(file).then((bitmap) => {
    const scale = Math.min(1, PHOTO_LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('That photo couldn\'t be read.'))), 'image/jpeg', 0.85);
    });
  });
}

document.querySelectorAll('[data-photo]').forEach((card) => {
  const key = card.dataset.photo;
  const status = card.querySelector('.photo-status');
  const fileInput = card.querySelector('input[type="file"]');
  const altInput = card.querySelector('[data-photo-alt]');

  const showProblem = (text) => {
    status.textContent = text;
    status.classList.add('is-problem');
  };

  fileInput.addEventListener('change', async () => {
    const [file] = fileInput.files;
    fileInput.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showProblem('That file isn\'t a photo. Please choose a photo.');
      return;
    }

    status.classList.remove('is-problem');
    status.textContent = 'Adding your photo…';
    showInPreview(PHOTO_PAGES[key]);
    try {
      const form = new FormData();
      form.append('photo', await shrinkPhoto(file).catch(() => {
        throw new Error('That photo couldn\'t be read. Please try a JPG or PNG photo.');
      }), 'photo.jpg');
      const { src } = await api('photos', { method: 'POST', body: form });
      change((draft) => {
        draft.photos[key] = { ...draft.photos[key], src };
      });
      fillPhotos();
      status.textContent = 'Photo added. Remember to describe it below.';
      altInput.focus();
      altInput.select();
    } catch (error) {
      showProblem(error.message);
    }
  });

  card.querySelector('[data-photo-reset]').addEventListener('click', () => {
    change((draft) => {
      draft.photos[key] = { ...defaults.photos[key] };
    });
    fillPhotos();
    status.classList.remove('is-problem');
    status.textContent = 'The original photo is back.';
  });

  altInput.addEventListener('input', () => {
    if (altInput.value.trim()) change((draft) => {
      draft.photos[key].alt = altInput.value;
    });
  });
});

// Photos the editor added are served from /api/photos, and the original
// photos from the website's own folder, one level up from /admin/.
function photoAddress(src) {
  return src.startsWith('/') ? src : `../${src}`;
}

export function fillPhotos() {
  document.querySelectorAll('[data-photo]').forEach((card) => {
    const photo = content.photos[card.dataset.photo];
    card.querySelector('.photo-thumb').src = photoAddress(photo.src);
    card.querySelector('[data-photo-alt]').value = photo.alt;
    card.querySelector('[data-photo-reset]').hidden = photo.src === defaults.photos[card.dataset.photo].src;
  });
}

export function focusPhoto(key) {
  const card = document.querySelector(`[data-photo="${CSS.escape(key)}"]`);
  card?.scrollIntoView({ block: 'center' });
  card?.querySelector('input[type="file"]').focus({ preventScroll: true });
  showInPreview(PHOTO_PAGES[key]);
}
