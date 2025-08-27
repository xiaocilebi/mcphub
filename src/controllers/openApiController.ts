import { Request, Response } from 'express';
import {
  generateOpenAPISpec,
  getAvailableServers,
  getToolStats,
  OpenAPIGenerationOptions,
} from '../services/openApiGeneratorService.js';
import { getServerByName } from '../services/mcpService.js';

/**
 * Controller for OpenAPI generation endpoints
 * Provides OpenAPI specifications for MCP tools to enable OpenWebUI integration
 */

/**
 * Convert query parameters to their proper types based on the tool's input schema
 */
function convertQueryParametersToTypes(
  queryParams: Record<string, any>,
  inputSchema: Record<string, any>,
): Record<string, any> {
  if (!inputSchema || typeof inputSchema !== 'object' || !inputSchema.properties) {
    return queryParams;
  }

  const convertedParams: Record<string, any> = {};
  const properties = inputSchema.properties;

  for (const [key, value] of Object.entries(queryParams)) {
    const propDef = properties[key];
    if (!propDef || typeof propDef !== 'object') {
      // No schema definition found, keep as is
      convertedParams[key] = value;
      continue;
    }

    const propType = propDef.type;

    try {
      switch (propType) {
        case 'integer':
        case 'number':
          // Convert string to number
          if (typeof value === 'string') {
            const numValue = propType === 'integer' ? parseInt(value, 10) : parseFloat(value);
            convertedParams[key] = isNaN(numValue) ? value : numValue;
          } else {
            convertedParams[key] = value;
          }
          break;

        case 'boolean':
          // Convert string to boolean
          if (typeof value === 'string') {
            convertedParams[key] = value.toLowerCase() === 'true' || value === '1';
          } else {
            convertedParams[key] = value;
          }
          break;

        case 'array':
          // Handle array conversion if needed (e.g., comma-separated strings)
          if (typeof value === 'string' && value.includes(',')) {
            convertedParams[key] = value.split(',').map((item) => item.trim());
          } else {
            convertedParams[key] = value;
          }
          break;

        default:
          // For string and other types, keep as is
          convertedParams[key] = value;
          break;
      }
    } catch (error) {
      // If conversion fails, keep the original value
      console.warn(`Failed to convert parameter '${key}' to type '${propType}':`, error);
      convertedParams[key] = value;
    }
  }

  return convertedParams;
}

/**
 * Generate and return OpenAPI specification
 * GET /api/openapi.json
 */
export const getOpenAPISpec = (req: Request, res: Response): void => {
  try {
    const options: OpenAPIGenerationOptions = {
      title: req.query.title as string,
      description: req.query.description as string,
      version: req.query.version as string,
      serverUrl: req.query.serverUrl as string,
      includeDisabledTools: req.query.includeDisabled === 'true',
      groupFilter: req.query.group as string,
      serverFilter: req.query.servers ? (req.query.servers as string).split(',') : undefined,
    };

    const openApiSpec = generateOpenAPISpec(options);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    res.json(openApiSpec);
  } catch (error) {
    console.error('Error generating OpenAPI specification:', error);
    res.status(500).json({
      error: 'Failed to generate OpenAPI specification',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get available servers for filtering
 * GET /api/openapi/servers
 */
export const getOpenAPIServers = (req: Request, res: Response): void => {
  try {
    const servers = getAvailableServers();
    res.json({
      success: true,
      data: servers,
    });
  } catch (error) {
    console.error('Error getting available servers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get available servers',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get tool statistics
 * GET /api/openapi/stats
 */
export const getOpenAPIStats = (req: Request, res: Response): void => {
  try {
    const stats = getToolStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting tool statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tool statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Execute tool via OpenAPI-compatible endpoint
 * This allows OpenWebUI to call MCP tools directly
 * POST /api/tools/:serverName/:toolName
 * GET /api/tools/:serverName/:toolName (for simple tools)
 */
export const executeToolViaOpenAPI = async (req: Request, res: Response): Promise<void> => {
  try {
    const { serverName, toolName } = req.params;

    // Import handleCallToolRequest function
    const { handleCallToolRequest } = await import('../services/mcpService.js');

    // Get the server info to access the tool's input schema
    const serverInfo = getServerByName(serverName);
    let inputSchema: Record<string, any> = {};

    if (serverInfo) {
      // Find the tool in the server's tools list
      const fullToolName = `${serverName}-${toolName}`;
      const tool = serverInfo.tools.find(
        (t: any) => t.name === fullToolName || t.name === toolName,
      );
      if (tool && tool.inputSchema) {
        inputSchema = tool.inputSchema as Record<string, any>;
      }
    }

    // Prepare arguments from query params (GET) or body (POST)
    let args = req.method === 'GET' ? req.query : req.body || {};
    args = convertQueryParametersToTypes(args, inputSchema);

    // Create a mock request structure that matches what handleCallToolRequest expects
    const mockRequest = {
      params: {
        name: toolName, // Just use the tool name without server prefix as it gets added by handleCallToolRequest
        arguments: args,
      },
    };

    const extra = {
      sessionId: (req.headers['x-session-id'] as string) || 'openapi-session',
      server: serverName,
    };

    const result = await handleCallToolRequest(mockRequest, extra);

    // Return the result in OpenAPI format (matching MCP tool response structure)
    res.json(result);
  } catch (error) {
    console.error('Error executing tool via OpenAPI:', error);
    res.status(500).json({
      error: 'Failed to execute tool',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
