const axios = require('axios');

class ShopifyAPI {
  constructor() {
    this.shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    this.baseURL = `https://${this.shopDomain}/admin/api/2023-10/`;
  }

  // Create headers for Shopify API requests
  getHeaders() {
    return {
      'X-Shopify-Access-Token': this.accessToken,
      'Content-Type': 'application/json'
    };
  }

  // Check if customer exists by email
  async findCustomerByEmail(email) {
    try {
      const response = await axios.get(
        `${this.baseURL}customers/search.json?query=email:${email}`,
        { headers: this.getHeaders() }
      );
      
      return response.data.customers.length > 0 ? response.data.customers[0] : null;
    } catch (error) {
      console.error('Error finding customer:', error.response?.data || error.message);
      throw error;
    }
  }

  // Create a new customer
  async createCustomer(customerData) {
    try {
      const { email, firstName } = customerData;
      
      const customer = {
        customer: {
          email: email,
          first_name: firstName,
          accepts_marketing: true,
          tags: 'newsletter-subscriber',
          verified_email: false,
          email_marketing_consent: {
            state: 'pending',
            opt_in_level: 'confirmed_opt_in',
            consent_updated_at: new Date().toISOString()
          }
        }
      };

      const response = await axios.post(
        `${this.baseURL}customers.json`,
        customer,
        { headers: this.getHeaders() }
      );

      return response.data.customers && response.data.customers.length > 0 
        ? response.data.customers[0] 
        : response.data.customer;
    } catch (error) {
      console.error('Error creating customer:', error.response?.data || error.message);
      throw error;
    }
  }

  // Update customer tags
  async updateCustomerTags(customerId, tags) {
    try {
      const customer = {
        customer: {
          id: customerId,
          tags: tags
        }
      };

      const response = await axios.put(
        `${this.baseURL}customers/${customerId}.json`,
        customer,
        { headers: this.getHeaders() }
      );

      return response.data.customer;
    } catch (error) {
      console.error('Error updating customer tags:', error.response?.data || error.message);
      throw error;
    }
  }

  // Check if customer has newsletter subscription tag
  isNewsletterSubscriber(customer) {
    if (!customer || !customer.tags) return false;
    
    const tags = customer.tags.toLowerCase();
    return tags.includes('newsletter-subscriber') && customer.accepts_marketing;
  }

  // Get customer orders (for behavioral data)
  async getCustomerOrders(customerId) {
    try {
      const response = await axios.get(
        `${this.baseURL}customers/${customerId}/orders.json`,
        { headers: this.getHeaders() }
      );
      
      return response.data.orders;
    } catch (error) {
      console.error('Error getting customer orders:', error.response?.data || error.message);
      return [];
    }
  }

  // Get products (for tracking product interactions)
  async getProducts(limit = 250) {
    try {
      const response = await axios.get(
        `${this.baseURL}products.json?limit=${limit}`,
        { headers: this.getHeaders() }
      );
      
      return response.data.products;
    } catch (error) {
      console.error('Error getting products:', error.response?.data || error.message);
      return [];
    }
  }

  // Get product by ID
  async getProduct(productId) {
    try {
      const response = await axios.get(
        `${this.baseURL}products/${productId}.json`,
        { headers: this.getHeaders() }
      );
      
      return response.data.product;
    } catch (error) {
      console.error('Error getting product:', error.response?.data || error.message);
      return null;
    }
  }
}

module.exports = ShopifyAPI;