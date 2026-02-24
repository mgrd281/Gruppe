/**
 * Workshop Gallery Zoom & Lightbox
 * Premium hover zoom + fullscreen gallery with mobile swipe
 */

(function() {
  'use strict';

  const LIGHTBOX_ID = 'workshop-lightbox';
  let lightbox = null;
  let mediaContainer = null;
  let currentIndex = 0;
  let totalMedia = 0;
  let productMedia = [];
  let isZoomed = false;
  let touchStartX = 0;
  let touchEndX = 0;

  /**
   * Initialize gallery zoom functionality
   */
  function init() {
    lightbox = document.getElementById(LIGHTBOX_ID);
    if (!lightbox) return;

    mediaContainer = lightbox.querySelector('[data-lightbox-media]');
    
    // Find all zoomable elements
    const zoomables = document.querySelectorAll('.workshop-gallery__zoomable');
    totalMedia = parseInt(lightbox.querySelector('[data-lightbox-total]')?.textContent || '0', 10);

    // Build media data from DOM
    buildMediaData(zoomables);

    // Attach click handlers
    zoomables.forEach((el, index) => {
      el.addEventListener('click', () => openLightbox(index));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(index);
        }
      });
    });

    // Lightbox controls
    setupLightboxControls();

    // Swipe gestures for mobile
    setupSwipeGestures();

    // Pinch zoom for images
    setupPinchZoom();
  }

  /**
   * Build media data array from DOM elements
   */
  function buildMediaData(zoomables) {
    productMedia = Array.from(zoomables).map(el => {
      const type = el.dataset.mediaType;
      const id = el.dataset.mediaId;
      const img = el.querySelector('.workshop-gallery__zoom-img');
      
      return {
        type: type,
        id: id,
        src: img?.src || '',
        alt: img?.alt || '',
        element: el
      };
    });
  }

  /**
   * Open lightbox at specific index
   */
  function openLightbox(index) {
    if (!lightbox || productMedia.length === 0) return;

    currentIndex = index;
    renderCurrentMedia();
    
    lightbox.classList.add('is-active');
    lightbox.setAttribute('aria-hidden', 'false');
    lightbox.setAttribute('data-total', totalMedia);
    document.body.classList.add('workshop-lightbox-open');

    // Focus management
    const closeBtn = lightbox.querySelector('.workshop-lightbox__close');
    if (closeBtn) closeBtn.focus();

    // Update counter
    updateCounter();
  }

  /**
   * Close lightbox
   */
  function closeLightbox() {
    if (!lightbox) return;

    lightbox.classList.remove('is-active');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('workshop-lightbox-open');
    
    // Reset zoom
    isZoomed = false;
    const img = mediaContainer?.querySelector('img');
    if (img) img.classList.remove('is-zoomed');
  }

  /**
   * Navigate to next media
   */
  function nextMedia() {
    if (currentIndex < totalMedia - 1) {
      currentIndex++;
      renderCurrentMedia();
      updateCounter();
      resetZoom();
    }
  }

  /**
   * Navigate to previous media
   */
  function prevMedia() {
    if (currentIndex > 0) {
      currentIndex--;
      renderCurrentMedia();
      updateCounter();
      resetZoom();
    }
  }

  /**
   * Render current media in lightbox
   */
  function renderCurrentMedia() {
    if (!mediaContainer || productMedia.length === 0) return;

    const media = productMedia[currentIndex];
    if (!media) return;

    let content = '';

    if (media.type === 'image' && media.src) {
      // Use high-res image for lightbox
      const highResSrc = media.src.replace(/_(\d+)x/, '_2000x');
      content = `<img src="${highResSrc}" alt="${media.alt}" loading="eager" draggable="false">`;
    } else if (media.type === 'video' || media.type === 'external_video') {
      // Clone the video element
      const videoWrapper = media.element.querySelector('.workshop-gallery__video-wrapper');
      if (videoWrapper) {
        content = videoWrapper.innerHTML;
      }
    }

    mediaContainer.innerHTML = content;

    // Add click-to-zoom for images
    const img = mediaContainer.querySelector('img');
    if (img) {
      img.addEventListener('click', toggleZoom);
    }
  }

  /**
   * Toggle zoom on image click
   */
  function toggleZoom() {
    const img = mediaContainer?.querySelector('img');
    if (!img) return;

    isZoomed = !isZoomed;
    img.classList.toggle('is-zoomed', isZoomed);
  }

  /**
   * Reset zoom state
   */
  function resetZoom() {
    isZoomed = false;
    const img = mediaContainer?.querySelector('img');
    if (img) img.classList.remove('is-zoomed');
  }

  /**
   * Update counter display
   */
  function updateCounter() {
    const currentEl = lightbox?.querySelector('[data-lightbox-current]');
    if (currentEl) currentEl.textContent = currentIndex + 1;

    // Update nav button states
    const prevBtn = lightbox?.querySelector('.workshop-lightbox__nav--prev');
    const nextBtn = lightbox?.querySelector('.workshop-lightbox__nav--next');
    
    if (prevBtn) prevBtn.disabled = currentIndex === 0;
    if (nextBtn) nextBtn.disabled = currentIndex === totalMedia - 1;
  }

  /**
   * Setup lightbox control buttons
   */
  function setupLightboxControls() {
    if (!lightbox) return;

    // Close button
    const closeBtn = lightbox.querySelector('.workshop-lightbox__close');
    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);

    // Navigation buttons
    const prevBtn = lightbox.querySelector('.workshop-lightbox__nav--prev');
    const nextBtn = lightbox.querySelector('.workshop-lightbox__nav--next');
    
    if (prevBtn) prevBtn.addEventListener('click', prevMedia);
    if (nextBtn) nextBtn.addEventListener('click', nextMedia);

    // Close on overlay click
    const overlay = lightbox.querySelector('.workshop-lightbox__overlay');
    if (overlay) overlay.addEventListener('click', closeLightbox);

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('is-active')) return;

      switch(e.key) {
        case 'Escape':
          closeLightbox();
          break;
        case 'ArrowLeft':
          prevMedia();
          break;
        case 'ArrowRight':
          nextMedia();
          break;
      }
    });
  }

  /**
   * Setup swipe gestures for mobile
   */
  function setupSwipeGestures() {
    if (!mediaContainer) return;

    mediaContainer.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    mediaContainer.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });
  }

  /**
   * Handle swipe gesture
   */
  function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swipe left - next
        nextMedia();
      } else {
        // Swipe right - prev
        prevMedia();
      }
    }
  }

  /**
   * Setup pinch-to-zoom for images
   */
  function setupPinchZoom() {
    if (!mediaContainer) return;

    let initialDistance = 0;
    let currentScale = 1;

    mediaContainer.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        initialDistance = getDistance(e.touches[0], e.touches[1]);
      }
    }, { passive: true });

    mediaContainer.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialDistance;
        
        const img = mediaContainer.querySelector('img');
        if (img) {
          currentScale = Math.min(Math.max(scale, 1), 3);
          img.style.transform = `scale(${currentScale})`;
        }
      }
    }, { passive: false });

    mediaContainer.addEventListener('touchend', () => {
      const img = mediaContainer.querySelector('img');
      if (img && currentScale < 1.2) {
        // Reset if not zoomed enough
        img.style.transform = '';
        currentScale = 1;
      }
    });
  }

  /**
   * Get distance between two touch points
   */
  function getDistance(touch1, touch2) {
    const dx = touch1.screenX - touch2.screenX;
    const dy = touch1.screenY - touch2.screenY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
