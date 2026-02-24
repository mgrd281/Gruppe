/**
 * Workshop Gallery Zoom & Lightbox
 * Premium hover zoom + fullscreen gallery with mobile swipe
 */

(function() {
  'use strict';

  const LIGHTBOX_ID = 'workshop-lightbox';
  const INIT_FLAG = 'workshopGalleryZoomInitialized';
  let lightbox = null;
  let mediaContainer = null;
  let currentIndex = 0;
  let totalMedia = 0;
  let productMedia = [];
  let isZoomed = false;
  let touchStartX = 0;
  let touchEndX = 0;
  let lastTapTs = 0;
  const DOUBLE_TAP_MS = 280;
  let isOpen = false;
  let isTransitioning = false;
  let cleanupTimer = null;
  let originalBodyOverflow = '';

  /**
   * Initialize gallery zoom functionality
   */
  function init() {
    if (window[INIT_FLAG]) return;
    window[INIT_FLAG] = true;

    lightbox = document.getElementById(LIGHTBOX_ID);
    if (!lightbox) return;

    mediaContainer = lightbox.querySelector('[data-lightbox-media]');
    
    // Find all zoomable elements
    const zoomables = document.querySelectorAll('.workshop-gallery__zoomable');

    // Build media data from DOM
    buildMediaData(zoomables);
    totalMedia = productMedia.length;

    // Attach click handlers
    zoomables.forEach((el, index) => {
      el.addEventListener('click', (e) => {
        // Single click/tap (via click) opens lightbox.
        // Avoid opening when user interacts with video controls.
        if (e.target && (e.target.closest('video') || e.target.closest('iframe') || e.target.closest('button'))) {
          return;
        }
        openLightbox(index);
      });
      el.addEventListener('dblclick', (e) => {
        // Prevent browser default double-click zoom / selection.
        if (e.cancelable) e.preventDefault();
      });
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
      const imageUrl = el.dataset.imageUrl || '';
      
      return {
        type: type,
        id: id,
        src: img?.src || '',
        imageUrl: imageUrl,
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
    if (isTransitioning) return;

    currentIndex = index;
    renderCurrentMedia();

    isTransitioning = true;
    lightbox.classList.add('is-active');
    lightbox.setAttribute('aria-hidden', 'false');
    lightbox.setAttribute('data-total', totalMedia);
    lockScroll();
    isOpen = true;

    // Focus management
    const closeBtn = lightbox.querySelector('.workshop-lightbox__close');
    if (closeBtn) closeBtn.focus();

    // Update counter
    updateCounter();

    clearTimeout(cleanupTimer);
    cleanupTimer = setTimeout(() => {
      isTransitioning = false;
    }, 260);
  }

  /**
   * Close lightbox
   */
  function closeLightbox() {
    if (!lightbox) return;
    if (isTransitioning) return;
    if (!isOpen) {
      // Safety: ensure scroll is not locked even if state got desynced.
      unlockScroll();
      return;
    }

    isTransitioning = true;

    lightbox.classList.remove('is-active');
    lightbox.setAttribute('aria-hidden', 'true');
    unlockScroll();
    isOpen = false;
    
    // Reset zoom
    resetZoom();

    clearTimeout(cleanupTimer);
    cleanupTimer = setTimeout(() => {
      isTransitioning = false;
      if (mediaContainer) mediaContainer.innerHTML = '';
    }, 260);
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

    if (media.type === 'image') {
      // Use explicit hi-res URL from Liquid to avoid brittle regex manipulation.
      const hiRes = media.imageUrl || media.src;
      if (hiRes) {
        content = `<img src="${hiRes}" alt="${escapeHtml(media.alt)}" loading="eager" draggable="false">`;
      }
    } else if (media.type === 'video' || media.type === 'external_video') {
      // Clone the video element
      const videoWrapper = media.element.querySelector('.workshop-gallery__video-wrapper');
      if (videoWrapper) {
        content = videoWrapper.innerHTML;
      }
    }

    mediaContainer.innerHTML = content;

    // Add zoom behavior for images inside lightbox only
    const img = mediaContainer.querySelector('img');
    if (img) {
      img.addEventListener('click', toggleZoom);
      img.addEventListener('touchend', (e) => {
        // Double-tap inside lightbox toggles zoom
        const now = Date.now();
        if (now - lastTapTs < DOUBLE_TAP_MS) {
          if (e.cancelable) e.preventDefault();
          toggleZoom();
          lastTapTs = 0;
          return;
        }
        lastTapTs = now;
      }, { passive: false });
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
    if (!isZoomed) {
      img.style.transform = '';
    }
  }

  /**
   * Reset zoom state
   */
  function resetZoom() {
    isZoomed = false;
    const img = mediaContainer?.querySelector('img');
    if (img) {
      img.classList.remove('is-zoomed');
      img.style.transform = '';
      img.style.transformOrigin = '';
    }
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

    // Keyboard navigation (single binding)
    document.addEventListener('keydown', onKeyDown);
  }

  function onKeyDown(e) {
    if (!lightbox || !lightbox.classList.contains('is-active')) return;

    switch (e.key) {
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
  }

  function lockScroll() {
    // Preserve original overflow to restore reliably.
    originalBodyOverflow = document.body.style.overflow;
    document.body.classList.add('workshop-lightbox-open');
    document.body.style.overflow = 'hidden';
  }

  function unlockScroll() {
    document.body.classList.remove('workshop-lightbox-open');
    document.body.style.overflow = originalBodyOverflow || '';
  }

  function escapeHtml(str) {
    return String(str || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  /**
   * Setup swipe gestures for mobile
   */
  function setupSwipeGestures() {
    if (!mediaContainer) return;

    mediaContainer.addEventListener('touchstart', (e) => {
      if (!lightbox || !lightbox.classList.contains('is-active')) return;
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    mediaContainer.addEventListener('touchend', (e) => {
      if (!lightbox || !lightbox.classList.contains('is-active')) return;
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
    let isPinching = false;

    mediaContainer.addEventListener('touchstart', (e) => {
      if (!lightbox || !lightbox.classList.contains('is-active')) return;
      const img = mediaContainer.querySelector('img');
      if (!img) return;

      if (e.touches.length === 2) {
        initialDistance = getDistance(e.touches[0], e.touches[1]);
        currentScale = 1;
        isPinching = true;
        img.style.transformOrigin = 'center center';
      }
    }, { passive: true });

    mediaContainer.addEventListener('touchmove', (e) => {
      if (!lightbox || !lightbox.classList.contains('is-active')) return;
      const img = mediaContainer.querySelector('img');
      if (!img) return;

      if (e.touches.length === 2 && isPinching && initialDistance > 0) {
        if (e.cancelable) e.preventDefault();
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialDistance;

        currentScale = Math.min(Math.max(scale, 1), 3);
        img.style.transform = `scale(${currentScale})`;
      }
    }, { passive: false });

    mediaContainer.addEventListener('touchend', () => {
      if (!lightbox || !lightbox.classList.contains('is-active')) return;
      const img = mediaContainer.querySelector('img');
      if (!img) return;

      if (!isPinching) return;
      isPinching = false;

      // If user didn't really zoom, reset.
      if (currentScale < 1.15) {
        img.style.transform = '';
        img.style.transformOrigin = '';
        currentScale = 1;
      } else {
        // Consider this a zoomed state; disable class-based zoom to avoid conflicts.
        isZoomed = false;
        img.classList.remove('is-zoomed');
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
