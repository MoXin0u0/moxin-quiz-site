const revealNodes = [...document.querySelectorAll('.reveal')];

if (
  document.documentElement.dataset.reduceMotion === 'true' ||
  matchMedia('(prefers-reduced-motion: reduce)').matches
) {
  revealNodes.forEach(node => node.classList.add('is-visible'));
} else if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });

  revealNodes.forEach(node => observer.observe(node));
} else {
  revealNodes.forEach(node => node.classList.add('is-visible'));
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(error => {
      console.warn('Service Worker registration failed on landing page.', error);
    });
  }, { once: true });
}
