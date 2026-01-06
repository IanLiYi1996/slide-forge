/**
 * Session Pool Manager
 *
 * Manages a pool of pre-initialized Agent SDK sessions to eliminate cold-start delays.
 *
 * Key Features:
 * - Pre-warm N sessions on server startup
 * - Instant session acquisition (no wait for initialization)
 * - Automatic session lifecycle management (expiration, cleanup, refill)
 * - Graceful degradation (falls back to on-demand creation if pool exhausted)
 *
 * Architecture:
 * - Pool Size: 3 sessions (configurable)
 * - Session Lifetime: 30 minutes or 10 uses
 * - Warmup Strategy: Parallel initialization on health check
 * - Resource Cleanup: Automatic retirement and replacement
 */

import "server-only";
import { AgentSessionInstance, agentService } from "./agent-service";
import type { AgentConfig } from "./types";

/**
 * Pooled session metadata
 */
interface PooledSession {
  id: string;
  session: AgentSessionInstance;
  createdAt: Date;
  lastUsedAt: Date;
  status: 'available' | 'in-use' | 'initializing' | 'error';
  useCount: number;
}

/**
 * Pool statistics for monitoring
 */
export interface PoolStats {
  total: number;
  available: number;
  inUse: number;
  initializing: number;
  error: number;
}

/**
 * Session Pool Manager
 * Singleton instance managing Agent SDK session pool
 */
export class SessionPoolManager {
  private pool: Map<string, PooledSession> = new Map();
  private readonly maxPoolSize: number;
  private readonly maxSessionAge: number;
  private readonly maxUseCount: number;
  public isWarming = false;

  constructor() {
    // Configuration from environment or defaults
    this.maxPoolSize = parseInt(process.env.AGENT_POOL_SIZE || '3', 10);
    this.maxSessionAge = 30 * 60 * 1000; // 30 minutes
    this.maxUseCount = 10; // Max uses per session

    console.log(`[SessionPool] Initialized with maxPoolSize=${this.maxPoolSize}`);
  }

  /**
   * Warm the pool by creating N sessions in parallel
   * Called on server startup via health check
   */
  async warmPool(): Promise<void> {
    if (this.isWarming) {
      console.log('[SessionPool] Warmup already in progress, skipping');
      return;
    }

    this.isWarming = true;
    console.log(`[SessionPool] Starting warmup: creating ${this.maxPoolSize} sessions...`);

    try {
      // Create all sessions in parallel
      const promises: Promise<void>[] = [];
      for (let i = 0; i < this.maxPoolSize; i++) {
        promises.push(
          this.createPooledSession().then((pooled) => {
            console.log(`[SessionPool] Created session ${pooled.id} (${i + 1}/${this.maxPoolSize})`);
          }).catch((error) => {
            console.error(`[SessionPool] Failed to create session ${i + 1}:`, error);
          })
        );
      }

      await Promise.all(promises);

      const stats = this.getPoolStats();
      console.log(`[SessionPool] Warmup complete: ${stats.available}/${this.maxPoolSize} sessions ready`);
    } catch (error) {
      console.error('[SessionPool] Warmup failed:', error);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Acquire a session from the pool
   * Returns immediately with a pre-initialized session if available,
   * otherwise creates one on-demand
   */
  async acquireSession(config?: AgentConfig): Promise<PooledSession> {
    const startTime = Date.now();

    // Try to get an available session from pool
    for (const [id, pooled] of this.pool.entries()) {
      if (pooled.status === 'available' && !this.isSessionExpired(pooled)) {
        pooled.status = 'in-use';
        pooled.lastUsedAt = new Date();
        pooled.useCount++;

        const acquireTime = Date.now() - startTime;
        console.log(`[SessionPool] Acquired session ${id} from pool in ${acquireTime}ms (useCount: ${pooled.useCount})`);

        return pooled;
      }
    }

    // Pool exhausted or empty - create on-demand (graceful degradation)
    console.warn('[SessionPool] Pool exhausted or empty, creating on-demand session');
    const pooled = await this.createPooledSession(config);

    const acquireTime = Date.now() - startTime;
    console.log(`[SessionPool] Created on-demand session ${pooled.id} in ${acquireTime}ms`);

    return pooled;
  }

  /**
   * Release a session back to the pool
   * Checks if session should be retired (expired or over-used)
   */
  releaseSession(sessionId: string): void {
    const pooled = this.pool.get(sessionId);
    if (!pooled) {
      console.warn(`[SessionPool] Cannot release unknown session: ${sessionId}`);
      return;
    }

    // Check if session should be retired
    if (this.isSessionExpired(pooled)) {
      console.log(`[SessionPool] Retiring expired session ${sessionId} (age: ${this.getSessionAge(pooled)}ms)`);
      this.retireSession(sessionId);
      // Trigger background refill
      this.refillPool();
    } else if (pooled.useCount >= this.maxUseCount) {
      console.log(`[SessionPool] Retiring over-used session ${sessionId} (uses: ${pooled.useCount})`);
      this.retireSession(sessionId);
      // Trigger background refill
      this.refillPool();
    } else {
      // Return to pool
      pooled.status = 'available';
      console.log(`[SessionPool] Released session ${sessionId} back to pool (useCount: ${pooled.useCount})`);
    }
  }

  /**
   * Get pool statistics for monitoring
   */
  getPoolStats(): PoolStats {
    const stats: PoolStats = {
      total: 0,
      available: 0,
      inUse: 0,
      initializing: 0,
      error: 0,
    };

    for (const pooled of this.pool.values()) {
      stats.total++;

      if (pooled.status === 'available') stats.available++;
      else if (pooled.status === 'in-use') stats.inUse++;
      else if (pooled.status === 'initializing') stats.initializing++;
      else if (pooled.status === 'error') stats.error++;
    }

    return stats;
  }

  /**
   * Create a new pooled session
   * @private
   */
  private async createPooledSession(config?: AgentConfig): Promise<PooledSession> {
    const poolId = `pool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const pooled: PooledSession = {
      id: poolId,
      session: null as any, // Will be set below
      createdAt: new Date(),
      lastUsedAt: new Date(),
      status: 'initializing',
      useCount: 0,
    };

    // Add to pool immediately with initializing status
    this.pool.set(poolId, pooled);

    try {
      // Create Agent SDK session
      // Use agentService to create the underlying AgentSessionInstance
      const session = agentService.createNewSession(poolId, config);

      // Wait for session to be ready (optional: add timeout)
      await this.waitForSessionReady(session, 60000); // 60s timeout

      pooled.session = session;
      pooled.status = 'available';

      return pooled;
    } catch (error) {
      console.error(`[SessionPool] Failed to create session ${poolId}:`, error);
      pooled.status = 'error';

      // Remove failed session from pool
      this.pool.delete(poolId);

      throw error;
    }
  }

  /**
   * Wait for agent session to be ready
   * @private
   */
  private async waitForSessionReady(session: AgentSessionInstance, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      // Check readiness periodically
      const checkInterval = setInterval(() => {
        if (session.isReady && session.isReady()) {
          clearInterval(checkInterval);
          resolve();
        } else if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          reject(new Error(`Session initialization timeout after ${timeoutMs}ms`));
        }
      }, 100); // Check every 100ms
    });
  }

  /**
   * Check if session has expired
   * @private
   */
  private isSessionExpired(pooled: PooledSession): boolean {
    const age = Date.now() - pooled.createdAt.getTime();
    return age > this.maxSessionAge;
  }

  /**
   * Get session age in milliseconds
   * @private
   */
  private getSessionAge(pooled: PooledSession): number {
    return Date.now() - pooled.createdAt.getTime();
  }

  /**
   * Retire a session (close and remove from pool)
   * @private
   */
  private retireSession(sessionId: string): void {
    const pooled = this.pool.get(sessionId);
    if (!pooled) return;

    try {
      pooled.session.close();
    } catch (error) {
      console.error(`[SessionPool] Error closing session ${sessionId}:`, error);
    }

    this.pool.delete(sessionId);
  }

  /**
   * Refill the pool in background (non-blocking)
   * @private
   */
  private refillPool(): void {
    const stats = this.getPoolStats();
    const deficit = this.maxPoolSize - stats.total;

    if (deficit > 0) {
      console.log(`[SessionPool] Pool deficit: ${deficit}, creating new sessions...`);

      // Create new sessions in background (don't await)
      for (let i = 0; i < deficit; i++) {
        this.createPooledSession().catch((error) => {
          console.error('[SessionPool] Refill failed:', error);
        });
      }
    }
  }

  /**
   * Cleanup expired and error sessions
   * Should be called periodically (e.g., every 5 minutes)
   */
  cleanup(): void {
    console.log('[SessionPool] Running cleanup...');

    for (const [id, pooled] of this.pool.entries()) {
      if (pooled.status === 'error' || this.isSessionExpired(pooled)) {
        console.log(`[SessionPool] Cleaning up session ${id} (status: ${pooled.status}, age: ${this.getSessionAge(pooled)}ms)`);
        this.retireSession(id);
      }
    }

    // Refill after cleanup
    this.refillPool();
  }

  /**
   * Shutdown all sessions (for graceful server shutdown)
   */
  shutdown(): void {
    console.log('[SessionPool] Shutting down, closing all sessions...');

    for (const [id, pooled] of this.pool.entries()) {
      try {
        pooled.session.close();
      } catch (error) {
        console.error(`[SessionPool] Error closing session ${id}:`, error);
      }
    }

    this.pool.clear();
    console.log('[SessionPool] Shutdown complete');
  }
}

// Export singleton instance
export const sessionPoolManager = new SessionPoolManager();

// Periodic cleanup disabled - we now use agentService.getOrCreateSession() instead
// which manages sessions by database sessionId for proper isolation
// if (typeof setInterval !== 'undefined') {
//   setInterval(() => {
//     sessionPoolManager.cleanup();
//   }, 5 * 60 * 1000);
// }
