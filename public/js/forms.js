// Requests and feedback are sent to Netlify Forms, which emails them on.
// They're sent in the background so the music keeps playing.

document.querySelectorAll('[data-form]').forEach((form) => {
  const status = form.querySelector('[data-form-status]');
  const submit = form.querySelector('[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    status.classList.remove('is-error');
    status.textContent = 'Sending…';

    try {
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString(),
      });
      if (!response.ok) throw new Error(response.statusText);
      form.reset();
      status.textContent = form.dataset.success;
    } catch {
      status.classList.add('is-error');
      status.textContent = "That didn't send. Please try again, or email coastradio@hotmail.com.";
    } finally {
      submit.disabled = false;
    }
  });
});
