import { describe, it, expect } from 'vitest'
import { userTools, getToolsForMode } from '@/lib/tools'

describe('Tool definitions', () => {
  describe('userTools', () => {
    it('has all required user tools', () => {
      const toolNames = userTools.map((t) => t.name)
      expect(toolNames).toContain('search_products')
      expect(toolNames).toContain('get_product_details')
      expect(toolNames).toContain('add_to_cart')
      expect(toolNames).toContain('view_cart')
      expect(toolNames).toContain('get_store_policies')
      expect(toolNames).toContain('list_products')
    })

    it('has exactly 9 tools (including global search and express checkout)', () => {
      expect(userTools).toHaveLength(9)
    })

    it('has search_global_products tool for cross-store search', () => {
      const toolNames = userTools.map((t) => t.name)
      expect(toolNames).toContain('search_global_products')
      const tool = userTools.find((t) => t.name === 'search_global_products')!
      expect(tool.parameters.required).toContain('query')
    })

    it('each tool has name, description, and parameters', () => {
      for (const tool of userTools) {
        expect(tool.name).toBeTruthy()
        expect(tool.description).toBeTruthy()
        expect(tool.parameters).toBeDefined()
        expect(tool.parameters.type).toBe('object')
      }
    })

    it('search_products requires query', () => {
      const tool = userTools.find((t) => t.name === 'search_products')!
      expect(tool.parameters.required).toContain('query')
    })

    it('search_products has optional max_price and occasion', () => {
      const tool = userTools.find((t) => t.name === 'search_products')!
      const props = tool.parameters.properties as Record<string, unknown>
      expect(props.query).toBeDefined()
      expect(props.max_price).toBeDefined()
      expect(props.occasion).toBeDefined()
    })

    it('get_product_details requires product_title', () => {
      const tool = userTools.find((t) => t.name === 'get_product_details')!
      expect(tool.parameters.required).toContain('product_title')
    })

    it('add_to_cart requires product_title', () => {
      const tool = userTools.find((t) => t.name === 'add_to_cart')!
      expect(tool.parameters.required).toContain('product_title')
    })

    it('add_to_cart has optional variant_name', () => {
      const tool = userTools.find((t) => t.name === 'add_to_cart')!
      const props = tool.parameters.properties as Record<string, unknown>
      expect(props.variant_name).toBeDefined()
    })

    it('get_store_policies requires policy_type', () => {
      const tool = userTools.find((t) => t.name === 'get_store_policies')!
      expect(tool.parameters.required).toContain('policy_type')
    })

    it('view_cart and list_products have no required params', () => {
      const viewCart = userTools.find((t) => t.name === 'view_cart')!
      const listProducts = userTools.find((t) => t.name === 'list_products')!
      expect(viewCart.parameters.required).toBeUndefined()
      expect(listProducts.parameters.required).toBeUndefined()
    })

    it('does not include admin-only tools', () => {
      const toolNames = userTools.map((t) => t.name)
      expect(toolNames).not.toContain('create_product')
      expect(toolNames).not.toContain('delete_product')
      expect(toolNames).not.toContain('update_product')
      expect(toolNames).not.toContain('set_inventory')
    })

    it('has express_checkout tool', () => {
      const toolNames = userTools.map((t) => t.name)
      expect(toolNames).toContain('express_checkout')
      const tool = userTools.find((t) => t.name === 'express_checkout')!
      expect(tool.parameters.required).toContain('product_title')
      const props = tool.parameters.properties as Record<string, unknown>
      expect(props.product_title).toBeDefined()
      expect(props.variant_name).toBeDefined()
    })

    it('has get_buyer_profile tool', () => {
      const toolNames = userTools.map((t) => t.name)
      expect(toolNames).toContain('get_buyer_profile')
      const tool = userTools.find((t) => t.name === 'get_buyer_profile')!
      expect(tool.parameters.type).toBe('object')
    })
  })

  describe('getToolsForMode', () => {
    it('returns user tools for user mode', () => {
      const tools = getToolsForMode('user')
      expect(tools).toBe(userTools)
    })

    it('returns user tools for any mode (admin removed)', () => {
      const tools = getToolsForMode('admin')
      expect(tools).toBe(userTools)
    })
  })
})
