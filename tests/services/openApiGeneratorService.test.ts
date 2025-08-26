import { generateOpenAPISpec, getToolStats } from '../../src/services/openApiGeneratorService';

describe('OpenAPI Generator Service', () => {
  describe('generateOpenAPISpec', () => {
    it('should generate a valid OpenAPI specification', () => {
      const spec = generateOpenAPISpec();
      
      // Check basic structure
      expect(spec).toHaveProperty('openapi');
      expect(spec).toHaveProperty('info');
      expect(spec).toHaveProperty('servers');
      expect(spec).toHaveProperty('paths');
      expect(spec).toHaveProperty('components');
      
      // Check OpenAPI version
      expect(spec.openapi).toBe('3.0.3');
      
      // Check info section
      expect(spec.info).toHaveProperty('title');
      expect(spec.info).toHaveProperty('description');
      expect(spec.info).toHaveProperty('version');
      
      // Check components
      expect(spec.components).toHaveProperty('schemas');
      expect(spec.components).toHaveProperty('securitySchemes');
      
      // Check security schemes
      expect(spec.components?.securitySchemes).toHaveProperty('bearerAuth');
    });

    it('should generate spec with custom options', () => {
      const options = {
        title: 'Custom API',
        description: 'Custom description',
        version: '2.0.0',
        serverUrl: 'https://custom.example.com'
      };
      
      const spec = generateOpenAPISpec(options);
      
      expect(spec.info.title).toBe('Custom API');
      expect(spec.info.description).toBe('Custom description');
      expect(spec.info.version).toBe('2.0.0');
      expect(spec.servers[0].url).toContain('https://custom.example.com');
    });
    
    it('should handle empty server list gracefully', () => {
      const spec = generateOpenAPISpec();
      
      // Should not throw and should have valid structure
      expect(spec).toHaveProperty('paths');
      expect(typeof spec.paths).toBe('object');
    });
  });

  describe('getToolStats', () => {
    it('should return valid tool statistics', () => {
      const stats = getToolStats();
      
      expect(stats).toHaveProperty('totalServers');
      expect(stats).toHaveProperty('totalTools');
      expect(stats).toHaveProperty('serverBreakdown');
      
      expect(typeof stats.totalServers).toBe('number');
      expect(typeof stats.totalTools).toBe('number');
      expect(Array.isArray(stats.serverBreakdown)).toBe(true);
    });
  });
});