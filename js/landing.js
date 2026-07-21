document.addEventListener('DOMContentLoaded', function () {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(function (item) {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', function () {
      const isOpen = item.classList.contains('open');
      faqItems.forEach(function (i) { i.classList.remove('open'); });
      if (!isOpen) item.classList.add('open');
    });
  });

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.feature-card').forEach(function (el) {
    observer.observe(el);
  });
});
