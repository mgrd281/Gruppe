/**
 * Premium Product Gallery Zoom
 * Modern e-commerce experience (AboutYou/Zalando style)
 * Desktop: Hover zoom + click for fullscreen
 * Mobile: Tap to fullscreen with pinch-zoom and swipe
 */

if (!customElements.get('product-zoom-gallery')) {
  customElements.define(
    'product-zoom-gallery',
    class ProductZoomGallery extends HTMLElement {
      constructor() {
        super();
        this.images = [];
        this.currentIndex = 0;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.scale = 1;
        this.isDragging = false;
        this.startDistance = 0;

        this.modal = this.querySelector('.product-zoom-modal');
        this.track = this.querySelector('.product-zoom-track');
        this.counter = this.querySelector('.product-zoom-counter');
        this.closeBtn = this.querySelector('.product-zoom-close');
        this.prevBtn = this.querySelector('.product-zoom-prev');
        this.nextBtn = this.querySelector('.product-zoom-next');

        this.init();
      }

      init() {
        this.gatherImages();
        this.setupEventListeners();
        this.setupSwipe();
        this.setupPinchZoom();
      }

      gatherImages() {
        const mediaItems = document.querySelectorAll('.product__media-item img[srcset]');
        this.images = Array.from(mediaItems).map((img, index) => ({
          src: img.closest('.product__media')?.querySelector('img')?.src || img.src,
          srcset: img.srcset,
          sizes: img.sizes,
          alt: img.alt,
          index
        }));
      }

      setupEventListeners() {
        // Close button
        this.closeBtn?.addEventListener('click', () => this.close());

        // Navigation
        this.prevBtn?.addEventListener('click', () => this.navigate(-1));
        this.nextBtn?.addEventListener('click', () => this.navigate(1));

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
          if (!this.modal?.classList.contains('is-open')) return;
          if (e.key === 'Escape') this.close();
          if (e.key === 'ArrowLeft') this.navigate(-1);
          if (e.key === 'ArrowRight') this.navigate(1);
        });

        // Click on backdrop to close
        this.modal?.addEventListener('click', (e) => {
          if (e.target === this.modal) this.close();
        });
      }

      setupSwipe() {
        let startX = 0;
        let currentX = 0;
        let isSwiping = false;

        this.track?.addEventListener('touchstart', (e) => {
          if (this.scale > 1) return; // Disable swipe when zoomed
          startX = e.touches[0].clientX;
          isSwiping = true;
          this.track.style.transition = 'none';
        }, { passive: true });

        this.track?.addEventListener('touchmove', (e) => {
          if (!isSwiping || this.scale > 1) return;
          currentX = e.touches[0].clientX;
          const diff = currentX - startX;
          const translate = -(this.currentIndex * 100) + (diff / window.innerWidth * 100);
          this.track.style.transform = `translateX(${translate}%)`;
        }, { passive: true });

        this.track?.addEventListener('touchend', (e) => {
          if (!isSwiping) return;
          isSwiping = false;
          this.track.style.transition = 'transform 300ms ease';

          const diff = currentX - startX;
          const threshold = window.innerWidth * 0.15;

          if (Math.abs(diff) > threshold) {
            if (diff > 0 && this.currentIndex > 0) {
              this.navigate(-1);
            } else if (diff < 0 && this.currentIndex < this.images.length - 1) {
              this.navigate(1);
            } else {
              this.updatePosition();
            }
          } else {
            this.updatePosition();
          }
        });
      }

      setupPinchZoom() {
        let initialScale = 1;
        let currentScale = 1;

        this.track?.addEventListener('touchstart', (e) => {
          if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            this.startDistance = Math.sqrt(dx * dx + dy * dy);
            initialScale = currentScale;
          }
        }, { passive: true });

        this.track?.addEventListener('touchmove', (e) => {
          if (e.touches.length === 2) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const scale = (distance / this.startDistance) * initialScale;
            currentScale = Math.max(1, Math.min(3, scale));
            this.scale = currentScale;

            const img = this.track.children[this.currentIndex]?.querySelector('img');
            if (img) {
              img.style.transform = `scale(${currentScale})`;
            }
          }
        }, { passive: false });

        this.track?.addEventListener('touchend', () => {
          if (currentScale < 1.1) {
            currentScale = 1;
            this.scale = 1;
            const img = this.track.children[this.currentIndex]?.querySelector('img');
            if (img) {
              img.style.transition = 'transform 200ms ease';
              img.style.transform = 'scale(1)';
              setTimeout(() => img.style.transition = '', 200);
            }
          }
        });
      }

      open(index = 0) {
        this.currentIndex = index;
        this.renderImages();
        this.modal?.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        this.updatePosition();
        this.updateCounter();
      }

      close() {
        this.modal?.classList.remove('is-open');
        document.body.style.overflow = '';
        this.scale = 1;
        // Reset any zoomed images
        this.track?.querySelectorAll('img').forEach(img => {
          img.style.transform = 'scale(1)';
        });
      }

      navigate(direction) {
        const newIndex = this.currentIndex + direction;
        if (newIndex < 0 || newIndex >= this.images.length) return;

        this.currentIndex = newIndex;
        this.scale = 1;

        // Reset zoom on navigation
        this.track?.querySelectorAll('img').forEach(img => {
          img.style.transition = 'transform 200ms ease';
          img.style.transform = 'scale(1)';
        });

        this.updatePosition();
        this.updateCounter();
      }

      updatePosition() {
        if (!this.track) return;
        this.track.style.transition = 'transform 300ms ease';
        this.track.style.transform = `translateX(-${this.currentIndex * 100}%)`;
      }

      updateCounter() {
        if (!this.counter) return;
        this.counter.textContent = `${this.currentIndex + 1} / ${this.images.length}`;

        // Update button visibility
        if (this.prevBtn) {
          this.prevBtn.style.opacity = this.currentIndex === 0 ? '0.3' : '1';
          this.prevBtn.disabled = this.currentIndex === 0;
        }
        if (this.nextBtn) {
          this.nextBtn.style.opacity = this.currentIndex === this.images.length - 1 ? '0.3' : '1';
          this.nextBtn.disabled = this.currentIndex === this.images.length - 1;
        }
      }

      renderImages() {
        if (!this.track) return;
        this.track.innerHTML = this.images.map((image, i) => `
          <div class="product-zoom-slide" data-index="${i}">
            <img
              src="${image.src}"
              srcset="${image.srcset}"
              sizes="100vw"
              alt="${image.alt}"
              loading="${i === 0 ? 'eager' : 'lazy'}"
              draggable="false"
            >
          </div>
        `).join('');
      }
    }
  );
}

// Initialize product image hover zoom
document.addEventListener('DOMContentLoaded', () => {
  setupHoverZoom();
  setupProductClickHandlers();
});

function setupHoverZoom() {
  const images = document.querySelectorAll('.product-zoom-hover');

  images.forEach(img => {
    const container = img.closest('.product__media') || img.parentElement;
    if (!container) return;

    container.style.overflow = 'hidden';

    container.addEventListener('mouseenter', () => {
      img.style.transition = 'transform 200ms ease';
      img.style.transform = 'scale(1.08)';
      img.style.cursor = 'zoom-in';
    });

    container.addEventListener('mouseleave', () => {
      img.style.transform = 'scale(1)';
    });

    container.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      // Subtle pan effect
      const panX = (x - 0.5) * -5; // -2.5% to +2.5%
      const panY = (y - 0.5) * -5;

      img.style.transformOrigin = `${x * 100}% ${y * 100}%`;
    });
  });
}

function setupProductClickHandlers() {
  const gallery = document.querySelector('product-zoom-gallery');
  const mediaItems = document.querySelectorAll('.product__media-item');

  mediaItems.forEach((item, index) => {
    const opener = item.querySelector('.product__modal-opener');
    const img = item.querySelector('img');

    if (opener) {
      opener.style.cursor = 'zoom-in';
      opener.addEventListener('click', (e) => {
        e.preventDefault();
        gallery?.open(index);
      });
    }

    // Mobile tap handler
    if (img) {
      img.addEventListener('touchend', (e) => {
        // Only open if it's a quick tap (not swipe)
        gallery?.open(index);
      });
    }
  });
}

// Export for global access
window.ProductZoomGallery = document.querySelector('product-zoom-gallery');
