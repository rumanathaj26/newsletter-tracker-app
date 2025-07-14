// Newsletter Tracker - Frontend Tracking Script
class NewsletterTracker {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.behavioralData = [];
    this.pageStartTime = Date.now();
    // Always point to your newsletter tracker app, regardless of where script is hosted
    this.apiBaseUrl = 'http://localhost:3000';
    this.currentEmail = null;
    
    this.init();
  }

  // Generate unique session ID
  generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Initialize tracking
  init() {
    this.trackPageView();
    this.setupEventListeners();
    this.detectUserLocation();
    
    // Store behavioral data every 5 seconds while browsing
    setInterval(() => {
      this.storeBehavioralDataLocally();
    }, 5000);
  }

  // Track page view
  trackPageView() {
    const pageData = {
      type: 'page_view',
      data: {
        url: window.location.href,
        title: document.title,
        referrer: document.referrer,
        timestamp: Date.now()
      },
      pageUrl: window.location.href
    };
    
    this.behavioralData.push(pageData);
    console.log('📊 Page view tracked:', window.location.href);
  }

  // Setup event listeners for clicks, form interactions, etc.
  setupEventListeners() {
    // Track all clicks
    document.addEventListener('click', (e) => {
      this.trackClick(e);
    });

    // Track all hovers on interactive elements
    document.addEventListener('mouseover', (e) => {
      this.trackHover(e);
    });

    // Track form interactions
    document.addEventListener('submit', (e) => {
      this.trackFormSubmission(e);
    });

    // Track input focus events
    document.addEventListener('focus', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        this.trackInputFocus(e);
      }
    }, true);

    // Track page unload to calculate time spent
    window.addEventListener('beforeunload', () => {
      this.trackTimeSpent();
      this.sendPageView(); // Send page view data before leaving
    });

    // Track scroll events (throttled)
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.trackScroll();
      }, 500);
    });

    // Track visibility changes
    document.addEventListener('visibilitychange', () => {
      this.trackVisibilityChange();
    });

    // Track e-commerce specific events
    this.setupEcommerceTracking();
  }

  // Track click events
  trackClick(event) {
    const element = event.target;
    const clickData = {
      type: 'click',
      data: {
        tagName: element.tagName,
        className: element.className,
        id: element.id,
        text: element.innerText?.substring(0, 100) || '',
        href: element.href || null,
        timestamp: Date.now(),
        x: event.clientX,
        y: event.clientY
      },
      pageUrl: window.location.href
    };

    this.behavioralData.push(clickData);
    console.log('👆 Click tracked:', element.tagName, element.innerText?.substring(0, 30));

    // If it's a product link, track product interaction
    if (element.href && (element.href.includes('/products/') || element.closest('[data-product-id]'))) {
      this.trackProductInteraction('click', element);
    }
  }

  // Track form submissions
  trackFormSubmission(event) {
    const form = event.target;
    const formData = {
      type: 'form_submission',
      data: {
        formId: form.id,
        formClass: form.className,
        action: form.action,
        method: form.method,
        timestamp: Date.now()
      },
      pageUrl: window.location.href
    };

    this.behavioralData.push(formData);
  }

  // Track time spent on page
  trackTimeSpent() {
    const timeSpent = Date.now() - this.pageStartTime;
    const timeData = {
      type: 'time_spent',
      data: {
        duration: timeSpent,
        url: window.location.href,
        timestamp: Date.now()
      },
      pageUrl: window.location.href
    };

    this.behavioralData.push(timeData);
  }

  // Track scroll events
  trackScroll() {
    const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
    
    const scrollData = {
      type: 'scroll',
      data: {
        scrollPercent: scrollPercent,
        scrollY: window.scrollY,
        timestamp: Date.now()
      },
      pageUrl: window.location.href
    };

    this.behavioralData.push(scrollData);
  }

  // Track hover events on interactive elements
  trackHover(event) {
    const element = event.target;
    
    // Only track hovers on interactive elements
    if (this.isInteractiveElement(element)) {
      const hoverData = {
        type: 'hover',
        data: {
          tagName: element.tagName,
          className: element.className,
          id: element.id,
          text: element.innerText?.substring(0, 50) || '',
          href: element.href || null,
          timestamp: Date.now()
        },
        pageUrl: window.location.href
      };

      this.behavioralData.push(hoverData);
      console.log('👀 Hover tracked:', element.tagName, element.innerText?.substring(0, 20));

      // Track product hovers specifically
      if (element.href && (element.href.includes('/products/') || element.closest('[data-product-id]'))) {
        this.trackProductInteraction('hover', element);
      }
    }
  }

  // Track input focus events
  trackInputFocus(event) {
    const element = event.target;
    const focusData = {
      type: 'input_focus',
      data: {
        inputType: element.type,
        inputName: element.name,
        inputId: element.id,
        placeholder: element.placeholder,
        timestamp: Date.now()
      },
      pageUrl: window.location.href
    };

    this.behavioralData.push(focusData);
  }

  // Track visibility changes (tab switching)
  trackVisibilityChange() {
    const visibilityData = {
      type: 'visibility_change',
      data: {
        hidden: document.hidden,
        timestamp: Date.now()
      },
      pageUrl: window.location.href
    };

    this.behavioralData.push(visibilityData);
  }

  // Check if element is interactive
  isInteractiveElement(element) {
    const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
    const interactiveClasses = ['btn', 'button', 'link', 'product', 'add-to-cart', 'checkout'];
    
    if (interactiveTags.includes(element.tagName)) return true;
    if (element.onclick) return true;
    if (element.href) return true;
    if (interactiveClasses.some(cls => element.className.toLowerCase().includes(cls))) return true;
    if (element.closest('[data-product-id]')) return true;
    
    return false;
  }

  // Setup e-commerce specific tracking
  setupEcommerceTracking() {
    // Track cart interactions
    this.trackCartEvents();
    
    // Track checkout events
    this.trackCheckoutEvents();
    
    // Track product view events
    this.trackProductViews();
    
    // Track search events
    this.trackSearchEvents();
  }

  // Track cart-related events
  trackCartEvents() {
    // Listen for add to cart clicks
    document.addEventListener('click', (e) => {
      const element = e.target;
      if (this.isAddToCartButton(element)) {
        this.trackCartAction('add_to_cart', element);
      }
      
      if (this.isCartButton(element)) {
        this.trackCartAction('view_cart', element);
      }
    });
  }

  // Track checkout events
  trackCheckoutEvents() {
    // Detect checkout page
    if (window.location.pathname.includes('/checkout') || 
        window.location.pathname.includes('/cart') ||
        document.querySelector('[data-checkout]')) {
      
      this.trackCheckoutStep();
    }
  }

  // Track product view events
  trackProductViews() {
    // Detect product page
    if (window.location.pathname.includes('/products/') || 
        document.querySelector('[data-product-id]')) {
      
      this.trackProductView();
    }
  }

  // Track search events
  trackSearchEvents() {
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (this.isSearchForm(form)) {
        this.trackSearch(form);
      }
    });
  }

  // Track product interactions
  trackProductInteraction(action, element) {
    const productData = {
      type: 'product_interaction',
      data: {
        action: action,
        productId: element.getAttribute('data-product-id') || this.extractProductIdFromUrl(element.href),
        productTitle: element.getAttribute('data-product-title') || element.innerText,
        timestamp: Date.now()
      },
      pageUrl: window.location.href
    };

    this.behavioralData.push(productData);
  }

  // Extract product ID from URL
  extractProductIdFromUrl(url) {
    if (!url) return null;
    const match = url.match(/\/products\/([^\/\?]+)/);
    return match ? match[1] : null;
  }

  // E-commerce helper methods
  isAddToCartButton(element) {
    const text = element.innerText?.toLowerCase() || '';
    const className = element.className?.toLowerCase() || '';
    
    return text.includes('add to cart') || 
           text.includes('add to bag') ||
           className.includes('add-to-cart') ||
           className.includes('add-cart') ||
           element.name === 'add' ||
           element.getAttribute('data-add-to-cart');
  }

  isCartButton(element) {
    const href = element.href?.toLowerCase() || '';
    const className = element.className?.toLowerCase() || '';
    
    return href.includes('/cart') ||
           className.includes('cart') ||
           element.getAttribute('data-cart');
  }

  isSearchForm(form) {
    const action = form.action?.toLowerCase() || '';
    const className = form.className?.toLowerCase() || '';
    
    return action.includes('/search') ||
           className.includes('search') ||
           form.querySelector('[name="q"]') ||
           form.querySelector('[name="query"]') ||
           form.querySelector('[type="search"]');
  }

  // Track cart actions
  trackCartAction(action, element) {
    const cartData = {
      type: 'cart_action',
      data: {
        action: action,
        productId: this.extractProductIdFromElement(element),
        productTitle: this.extractProductTitleFromElement(element),
        timestamp: Date.now()
      },
      pageUrl: window.location.href
    };

    this.behavioralData.push(cartData);
  }

  // Track checkout steps
  trackCheckoutStep() {
    const checkoutData = {
      type: 'checkout_step',
      data: {
        step: this.getCheckoutStep(),
        timestamp: Date.now()
      },
      pageUrl: window.location.href
    };

    this.behavioralData.push(checkoutData);
  }

  // Track product view
  trackProductView() {
    const productData = {
      type: 'product_view',
      data: {
        productId: this.getCurrentProductId(),
        productTitle: this.getCurrentProductTitle(),
        productPrice: this.getCurrentProductPrice(),
        productCategory: this.getCurrentProductCategory(),
        timestamp: Date.now()
      },
      pageUrl: window.location.href
    };

    this.behavioralData.push(productData);
  }

  // Track search
  trackSearch(form) {
    const searchInput = form.querySelector('[name="q"], [name="query"], [type="search"]');
    const query = searchInput?.value || '';

    const searchData = {
      type: 'search',
      data: {
        query: query,
        timestamp: Date.now()
      },
      pageUrl: window.location.href
    };

    this.behavioralData.push(searchData);
  }

  // Helper methods for product extraction
  extractProductIdFromElement(element) {
    // Try various methods to extract product ID
    return element.getAttribute('data-product-id') ||
           element.closest('[data-product-id]')?.getAttribute('data-product-id') ||
           this.extractProductIdFromUrl(element.href) ||
           this.extractProductIdFromUrl(window.location.href);
  }

  extractProductTitleFromElement(element) {
    // Try to find product title
    return element.getAttribute('data-product-title') ||
           element.closest('[data-product-title]')?.getAttribute('data-product-title') ||
           document.querySelector('h1.product-title, .product-title h1, [data-product-title]')?.innerText ||
           document.title;
  }

  getCurrentProductId() {
    return document.querySelector('[data-product-id]')?.getAttribute('data-product-id') ||
           this.extractProductIdFromUrl(window.location.href);
  }

  getCurrentProductTitle() {
    return document.querySelector('h1.product-title, .product-title h1, [data-product-title]')?.innerText ||
           document.querySelector('.product-title')?.innerText ||
           document.title;
  }

  getCurrentProductPrice() {
    const priceElement = document.querySelector('.price, .product-price, [data-price], .money');
    return priceElement?.innerText || null;
  }

  getCurrentProductCategory() {
    return document.querySelector('[data-product-category]')?.getAttribute('data-product-category') ||
           document.querySelector('.product-category, .breadcrumb')?.innerText ||
           null;
  }

  getCheckoutStep() {
    if (window.location.pathname.includes('/checkout/contact')) return 'contact_info';
    if (window.location.pathname.includes('/checkout/shipping')) return 'shipping_info';
    if (window.location.pathname.includes('/checkout/payment')) return 'payment_info';
    if (window.location.pathname.includes('/checkout')) return 'checkout_start';
    if (window.location.pathname.includes('/cart')) return 'cart_view';
    return 'unknown';
  }

  // Send page view data to server
  async sendPageView() {
    const timeSpent = Date.now() - this.pageStartTime;
    
    // Store page view data locally if no email yet
    const pageViewData = {
      sessionId: this.sessionId,
      pageUrl: window.location.href,
      pageTitle: document.title,
      timeSpent: timeSpent,
      referrer: document.referrer,
      timestamp: Date.now()
    };

    // Store in localStorage for later sending
    this.storePageViewLocally(pageViewData);
    
    // If user is identified, send immediately
    if (this.currentEmail) {
      try {
        await fetch(`${this.apiBaseUrl}/api/track/page-view`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: this.currentEmail,
            ...pageViewData
          })
        });
      } catch (error) {
        console.error('Page view tracking error:', error);
      }
    }
  }

  // Store page view data locally
  storePageViewLocally(pageViewData) {
    try {
      const storedPageViews = JSON.parse(localStorage.getItem('newsletterTracker_pageViews') || '[]');
      storedPageViews.push(pageViewData);
      
      // Keep only last 50 page views to prevent storage overflow
      if (storedPageViews.length > 50) {
        storedPageViews.splice(0, storedPageViews.length - 50);
      }
      
      localStorage.setItem('newsletterTracker_pageViews', JSON.stringify(storedPageViews));
    } catch (error) {
      console.error('Could not store page view locally:', error);
    }
  }

  // Store behavioral data locally
  storeBehavioralDataLocally() {
    try {
      const storedBehavioralData = JSON.parse(localStorage.getItem('newsletterTracker_behavioral') || '[]');
      const newData = [...storedBehavioralData, ...this.behavioralData];
      
      // Keep only last 100 events to prevent storage overflow
      if (newData.length > 100) {
        newData.splice(0, newData.length - 100);
      }
      
      localStorage.setItem('newsletterTracker_behavioral', JSON.stringify(newData));
      this.behavioralData = []; // Clear current data after storing
    } catch (error) {
      console.error('Could not store behavioral data locally:', error);
    }
  }

  // Send all stored data after signup
  async sendStoredData() {
    if (!this.currentEmail) return;

    try {
      // Send stored page views
      const storedPageViews = JSON.parse(localStorage.getItem('newsletterTracker_pageViews') || '[]');
      for (const pageView of storedPageViews) {
        await fetch(`${this.apiBaseUrl}/api/track/page-view`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: this.currentEmail,
            ...pageView
          })
        });
      }

      // Send stored behavioral data
      const storedBehavioral = JSON.parse(localStorage.getItem('newsletterTracker_behavioral') || '[]');
      for (const event of storedBehavioral) {
        await fetch(`${this.apiBaseUrl}/api/track/event`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: this.currentEmail,
            sessionId: this.sessionId,
            eventType: event.type,
            eventData: JSON.stringify(event.data),
            pageUrl: event.pageUrl
          })
        });
      }

      // Clear stored data after sending
      localStorage.removeItem('newsletterTracker_pageViews');
      localStorage.removeItem('newsletterTracker_behavioral');
      
      console.log('📊 Sent stored tracking data:', storedPageViews.length, 'page views,', storedBehavioral.length, 'events');

    } catch (error) {
      console.error('Error sending stored data:', error);
    }
  }

  // Detect user location (using a free IP geolocation service)
  async detectUserLocation() {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const locationData = await response.json();
      
      this.locationData = {
        country: locationData.country_name,
        region: locationData.region,
        city: locationData.city,
        timezone: locationData.timezone
      };
    } catch (error) {
      console.log('Could not detect location:', error);
      this.locationData = {};
    }
  }

  // Get device information
  getDeviceInfo() {
    return {
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform
    };
  }

  // Handle newsletter form submission
  async handleNewsletterSignup(email, firstName, captchaToken) {
    try {
      this.currentEmail = email;
      
      // Store any remaining behavioral data before sending
      this.storeBehavioralDataLocally();
      
      const signupData = {
        email: email,
        firstName: firstName,
        captchaToken: captchaToken,
        sessionId: this.sessionId,
        behavioralData: this.behavioralData,
        deviceData: this.getDeviceInfo(),
        locationData: this.locationData
      };

      const response = await fetch(`${this.apiBaseUrl}/api/newsletter/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signupData)
      });

      const result = await response.json();
      
      // Send all stored tracking data after successful signup
      if (result.success) {
        console.log('📊 Sending stored tracking data after signup...');
        await this.sendStoredData();
      }
      
      return result;

    } catch (error) {
      console.error('Newsletter signup error:', error);
      return { success: false, message: 'Network error occurred' };
    }
  }

  // Send behavioral event to server
  async sendEvent(eventType, eventData) {
    if (!this.currentEmail) return;

    try {
      await fetch(`${this.apiBaseUrl}/api/track/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: this.currentEmail,
          sessionId: this.sessionId,
          eventType: eventType,
          eventData: eventData,
          pageUrl: window.location.href
        })
      });
    } catch (error) {
      console.error('Event tracking error:', error);
    }
  }

  // Public method to track custom events
  track(eventType, data = {}) {
    const eventData = {
      type: eventType,
      data: {
        ...data,
        timestamp: Date.now()
      },
      pageUrl: window.location.href
    };

    this.behavioralData.push(eventData);

    // Send to server if user is identified
    if (this.currentEmail) {
      this.sendEvent(eventType, data);
    }
  }
}

// Initialize tracker
window.NewsletterTracker = new NewsletterTracker();

// Export for use in your newsletter form
window.handleNewsletterSignup = (email, firstName, captchaToken) => {
  return window.NewsletterTracker.handleNewsletterSignup(email, firstName, captchaToken);
};

// Export track function for custom events
window.trackEvent = (eventType, data) => {
  window.NewsletterTracker.track(eventType, data);
};