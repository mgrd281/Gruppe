if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton.querySelector('span');

        if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';

        this.isWorkshopBooking = this.dataset.workshopBooking === 'true';
        if (this.isWorkshopBooking) {
          this.bookingFields = Array.from(this.querySelectorAll('[data-booking-field]'));
          this.bookingRequiredFields = Array.from(this.querySelectorAll('[data-booking-required]'));
          this.bookingErrors = Array.from(this.querySelectorAll('[data-booking-error-for]'));
          this.paymentButton = this.querySelector('.shopify-payment-button__button');
          this.stepButtons = Array.from(this.querySelectorAll('[data-booking-step]'));

          this.stepButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
              const step = Number(btn.dataset.bookingStep || 0);
              const persons = this.querySelector('[data-booking-field="persons"]');
              if (!persons) return;
              const current = Number(persons.value || 1);
              const next = Math.max(Number(persons.getAttribute('min') || 1), current + step);
              persons.value = String(next);
              persons.dispatchEvent(new Event('input', { bubbles: true }));
            });
          });

          this.bookingFields.forEach((el) => {
            el.addEventListener('input', () => this.updateBookingState());
            el.addEventListener('change', () => this.updateBookingState());
            el.addEventListener('blur', () => this.updateBookingState(true));
          });

          if (this.paymentButton) {
            this.paymentButton.addEventListener(
              'click',
              (e) => {
                if (this.validateBooking(true) === false) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              },
              true
            );
          }

          this.updateBookingState();
        }
      }

      updateBookingState(showErrors = false) {
        if (!this.isWorkshopBooking) return;
        const valid = this.validateBooking(showErrors);
        this.toggleBookingButtons(!valid);
      }

      toggleBookingButtons(disable = true) {
        if (this.submitButton) {
          if (disable) {
            this.submitButton.setAttribute('disabled', 'disabled');
          } else {
            this.submitButton.removeAttribute('disabled');
          }
        }

        if (this.paymentButton) {
          if (disable) {
            this.paymentButton.setAttribute('disabled', 'disabled');
            this.paymentButton.setAttribute('aria-disabled', 'true');
          } else {
            this.paymentButton.removeAttribute('disabled');
            this.paymentButton.removeAttribute('aria-disabled');
          }
        }
      }

      validateBooking(showErrors = false) {
        if (!this.isWorkshopBooking) return true;

        let valid = true;
        this.bookingRequiredFields.forEach((field) => {
          const key = field.dataset.bookingField;
          const value = String(field.value || '').trim();
          let fieldValid = value.length > 0;

          if (key === 'persons') {
            const n = Number(value);
            fieldValid = Number.isFinite(n) && n >= 1;
          }

          if (!fieldValid) valid = false;

          const err = this.querySelector(`[data-booking-error-for="${key}"]`);
          if (err) {
            err.toggleAttribute('hidden', !(showErrors && !fieldValid));
          }

          field.toggleAttribute('aria-invalid', showErrors && !fieldValid);
        });

        return valid;
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        if (this.isWorkshopBooking && this.validateBooking(true) === false) {
          this.toggleBookingButtons(true);
          return;
        }

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        this.querySelector('.loading__spinner').classList.remove('hidden');

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);
        if (this.cart) {
          formData.append(
            'sections',
            this.cart.getSectionsToRender().map((section) => section.id)
          );
          formData.append('sections_url', window.location.pathname);
          this.cart.setActiveElement(document.activeElement);
        }
        config.body = formData;

        fetch(`${routes.cart_add_url}`, config)
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              publish(PUB_SUB_EVENTS.cartError, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                errors: response.errors || response.description,
                message: response.message,
              });
              this.handleErrorMessage(response.description);

              const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
              if (!soldOutMessage) return;
              this.submitButton.setAttribute('aria-disabled', true);
              this.submitButtonText.classList.add('hidden');
              soldOutMessage.classList.remove('hidden');
              this.error = true;
              return;
            } else if (!this.cart) {
              window.location = window.routes.cart_url;
              return;
            }

            const startMarker = CartPerformance.createStartingMarker('add:wait-for-subscribers');
            if (!this.error)
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                cartData: response,
              }).then(() => {
                CartPerformance.measureFromMarker('add:wait-for-subscribers', startMarker);
              });
            this.error = false;
            const quickAddModal = this.closest('quick-add-modal');
            if (quickAddModal) {
              document.body.addEventListener(
                'modalClosed',
                () => {
                  setTimeout(() => {
                    CartPerformance.measure("add:paint-updated-sections", () => {
                      this.cart.renderContents(response);
                    });
                  });
                },
                { once: true }
              );
              quickAddModal.hide(true);
            } else {
              CartPerformance.measure("add:paint-updated-sections", () => {
                this.cart.renderContents(response);
              });
            }
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.submitButton.classList.remove('loading');
            if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
            if (!this.error) this.submitButton.removeAttribute('aria-disabled');
            this.querySelector('.loading__spinner').classList.add('hidden');

            CartPerformance.measureFromEvent("add:user-action", evt);
          });
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    }
  );
}
