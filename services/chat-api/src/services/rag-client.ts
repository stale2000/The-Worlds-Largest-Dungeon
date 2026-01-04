/**
 * RAG Server Client - Interfaces with the Index Foundry generated RAG server
 * 
 * Endpoints used:
 * - POST /search - Hybrid/semantic/keyword search
 * - GET /health - Health check
 */

import { createRagSourceReference, type SourceReference } from '../utils/source-mapper.js';

const RAG_SERVER_URL = process.env.RAG_SERVER_URL || 'http://localhost:8080';

export interface RagSearchResult {
  chunk_id: string;
  text: string;
  score: number;
  source_id: string;
  source_url: string | null;
  source_name: string | null;
  source_type: string | null;
  position: {
    index: number;
    start_char: number;
    end_char: number;
  };
  metadata: Record<string, unknown>;
}

export interface RagSearchResponse {
  results: RagSearchResult[];
  total: number;
  query: string;
  mode: string;
}

export interface RagHealthResponse {
  status: string;
  project: string;
  chunks: number;
  vectors: number;
  sources: number;
  uptime: number;
}

export interface ProcessedRagResult {
  text: string;
  score: number;
  chunkId: string;
  source: SourceReference;
}

/**
 * Search the RAG server for relevant content
 * 
 * @param query - Search query text
 * @param mode - Search mode: 'keyword', 'semantic', or 'hybrid'
 * @param topK - Number of results to return (default 10)
 * @returns Search results with source references
 */
export async function searchRag(
  query: string,
  mode: 'keyword' | 'semantic' | 'hybrid' = 'hybrid',
  topK: number = 10
): Promise<ProcessedRagResult[]> {
  try {
    const response = await fetch(`${RAG_SERVER_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        mode,
        top_k: topK,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RAG search failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json() as RagSearchResponse;
    
    // Process results and map sources to web URLs
    return data.results.map(result => ({
      text: result.text,
      score: result.score,
      chunkId: result.chunk_id,
      source: createRagSourceReference(
        result.source_url || result.source_id,
        result.source_name,
        result.text
      ),
    }));
  } catch (error) {
    console.error('RAG search error:', error);
    throw error;
  }
}

/**
 * Check RAG server health status
 * 
 * @returns Health status or null if unavailable
 */
export async function checkRagHealth(): Promise<RagHealthResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${RAG_SERVER_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json() as RagHealthResponse;
  } catch (error) {
    console.error('RAG health check failed:', error);
    return null;
  }
}

/**
 * Get RAG server statistics
 */
interface RagStatsResponse {
  project: string;
  chunks: number;
  vectors: number;
  sources: number;
  has_embeddings: boolean;
}

export async function getRagStats(): Promise<RagStatsResponse | null> {
  try {
    const response = await fetch(`${RAG_SERVER_URL}/stats`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json() as RagStatsResponse;
  } catch (error) {
    console.error('RAG stats fetch failed:', error);
    return null;
  }
}

/**
 * Build context string from RAG results for LLM consumption
 * 
 * @param results - Processed RAG results
 * @returns Formatted context string with source citations
 */
export function buildRagContext(results: ProcessedRagResult[]): string {
  if (results.length === 0) {
    return 'No relevant documents found in RAG search.';
  }
  
  return results
    .map((result, index) => {
      const sourceRef = `[RAG Source ${index + 1}: ${result.source.reference}]`;
      return `${sourceRef}\n${result.text}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Get the configured RAG server URL for diagnostics
 */
export function getRagServerUrl(): string {
  return RAG_SERVER_URL;
}
