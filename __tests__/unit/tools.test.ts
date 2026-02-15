import { describe, it, expect } from 'vitest'
import { adminTools, userTools, getToolsForMode } from '@/lib/tools'

describe('Tool definitions', () => {
  describe('adminTools', () => {
    it('has all required admin tools', () => {
      const toolNames = adminTools.map((t) => t.name)
      expect(toolNames).toContain('get_store_info')
      expect(toolNames).toContain('list_products')
      expect(toolNames).toContain('get_product')
      expect(toolNames).toContain('create_product')
      expect(toolNames).toContain('update_product')
      expect(toolNames).toContain('delete_product')
      expect(toolNames).toContain('update_variant_price')
      expect(toolNames).toContain('set_inventory')
    })

    it('each tool has name, description, and parameters', () => {
      for (const tool of adminTools) {
        expect(tool.name).toBeTruthy()
        expect(tool.description).toBeTruthy()
        expect(tool.parameters).toBeDefined()
        expect(tool.parameters.type).toBe('object')
      }
    })

    it('create_product requires title', () => {
      const tool = adminTools.find((t) => t.name === 'create_product')!
      expect(tool.parameters.required).toContain('title')
    })

    it('delete_product requires productId', () => {
      const tool = adminTools.find((t) => t.name === 'delete_product')!
      expect(tool.parameters.required).toContain('productId')
    })
  })

  describe('userTools', () => {
    it('has all required user tools', () => {
      const toolNames = userTools.map((t) => t.name)
      expect(toolNames).toContain('list_products')
      expect(toolNames).toContain('recommend_products')
      expect(toolNames).toContain('get_product')
      expect(toolNames).toContain('create_checkout')
    })

    it('does not include admin-only tools', () => {
      const toolNames = userTools.map((t) => t.name)
      expect(toolNames).not.toContain('create_product')
      expect(toolNames).not.toContain('delete_product')
      expect(toolNames).not.toContain('update_product')
      expect(toolNames).not.toContain('set_inventory')
    })

    it('create_checkout requires items', () => {
      const tool = userTools.find((t) => t.name === 'create_checkout')!
      expect(tool.parameters.required).toContain('items')
    })

    it('recommend_products has occasion, region, budgetMax params', () => {
      const tool = userTools.find((t) => t.name === 'recommend_products')!
      const props = tool.parameters.properties as Record<string, unknown>
      expect(props.occasion).toBeDefined()
      expect(props.region).toBeDefined()
      expect(props.budgetMax).toBeDefined()
      expect(props.topN).toBeDefined()
    })
  })

  describe('getToolsForMode', () => {
    it('returns admin tools for admin mode', () => {
      const tools = getToolsForMode('admin')
      expect(tools).toBe(adminTools)
    })

    it('returns user tools for user mode', () => {
      const tools = getToolsForMode('user')
      expect(tools).toBe(userTools)
    })
  })
})
