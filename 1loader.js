document.addEventListener('DOMContentLoaded', () => {
  let loaderShown = false;

  // Only show loader + hide body if page takes more than 1 second
  const showLoader = setTimeout(() => {
    loaderShown = true;

    // Hide body now
    document.body.style.visibility = 'hidden';

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
      #page-loader {
        position: fixed; inset: 0;
        background: #0f0f10;
        display: flex;
        flex-direction: column;
        align-items: center;dawdaw
        justify-content: center;
        z-index: 999999;
        gap: 16px;
        opacity: 1;
        transition: opacity 0.4s ease;
      }
      #page-loader.hidden { opacity: 0; pointer-events: none; }
      .parchrome-ring {
        width: 44px; height: 44px;
        border-radius: 50%;
        border: 3px solid #2a2a2a;
        border-top: 3px solid #9f0000;
        animation: parchrome-spin 0.9s cubic-bezier(0.4,0,0.2,1) infinite;
      }
      .parchrome-label {
        font-size: 11px;
        letter-spacing: 3px;
        text-transform: uppercase;
        color: #555;
        font-family: sans-serif;
      }
      @keyframes parchrome-spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    // Inject loader HTML
    const loader = document.createElement('div');
    loader.id = 'page-loader';
    loader.innerHTML = `
      <div class="parchrome-ring"></div>
      <span class="parchrome-label">Parchrome</span>
    `;
    document.body.appendChild(loader);

  }, 5000);

  // When page fully loads
  window.addEventListener('load', () => {
    clearTimeout(showLoader); // cancel loader if page was fast

    if (loaderShown) {
      document.body.style.visibility = 'visible';
      const l = document.getElementById('page-loader');
      if (l) {
        l.classList.add('hidden');
        setTimeout(() => l.remove(), 400);
      }
    }
    // if loaderShown is false, body was never hidden, nothing to do
  });
});