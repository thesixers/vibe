/**
 * Cluster Mode Support for Vibe Framework
 * Enables multi-process scaling using Node.js cluster module
 */
import cluster from "node:cluster";
import os from "node:os";
import { color } from "../helpers/colors.js";

/**
 * Cluster configuration options
 * @typedef {Object} ClusterOptions
 * @property {number} [workers] - Number of worker processes (default: CPU count)
 * @property {boolean} [restart] - Auto-restart crashed workers (default: true)
 * @property {number} [restartDelay] - Delay before restarting (ms, default: 1000)
 * @property {Function} [onWorkerStart] - Called when worker starts
 * @property {Function} [onWorkerExit] - Called when worker exits
 */

/**
 * Start the application in cluster mode
 * @param {Function} startFn - Function that initializes and starts the app
 * @param {ClusterOptions} [options={}] - Cluster configuration
 */
export function clusterize(startFn, options = {}) {
  const {
    workers = os.cpus().length,
    restart = true,
    restartDelay = 1000,
    onWorkerStart,
    onWorkerExit,
  } = options;

  if (cluster.isPrimary) {
    console.log(
      color.cyan(
        `[VIBE CLUSTER] Primary ${process.pid} starting ${workers} workers...`,
      ),
    );

    // Fork workers
    for (let i = 0; i < workers; i++) {
      forkWorker(onWorkerStart);
    }

    // Handle worker exit
    cluster.on("exit", (worker, code, signal) => {
      const reason = signal || `code ${code}`;
      console.log(
        color.yellow(
          `[VIBE CLUSTER] Worker ${worker.process.pid} exited (${reason})`,
        ),
      );

      if (onWorkerExit) {
        onWorkerExit(worker, code, signal);
      }

      // Restart worker if enabled and not intentional exit
      if (restart && code !== 0) {
        console.log(
          color.cyan(
            `[VIBE CLUSTER] Restarting worker in ${restartDelay}ms...`,
          ),
        );
        setTimeout(() => forkWorker(onWorkerStart), restartDelay);
      }
    });

    // Handle primary process signals
    process.on("SIGTERM", () => gracefulShutdown());
    process.on("SIGINT", () => gracefulShutdown());
  } else {
    // Worker process - start the app
    console.log(color.green(`[VIBE CLUSTER] Worker ${process.pid} started`));
    startFn();
  }
}

/**
 * Fork a new worker
 * @param {Function} [onStart] - Callback when worker starts
 */
function forkWorker(onStart) {
  const worker = cluster.fork();

  worker.on("online", () => {
    if (onStart) onStart(worker);
  });

  return worker;
}

/**
 * Gracefully shutdown all workers
 */
function gracefulShutdown() {
  console.log(color.yellow("\n[VIBE CLUSTER] Shutting down..."));

  for (const id in cluster.workers) {
    cluster.workers[id].send("shutdown");
    cluster.workers[id].disconnect();
  }

  // Force exit after timeout
  setTimeout(() => {
    console.log(color.red("[VIBE CLUSTER] Forcing shutdown"));
    process.exit(0);
  }, 5000);
}

/**
 * Check if current process is the primary
 * @returns {boolean}
 */
export function isPrimary() {
  return cluster.isPrimary;
}

/**
 * Check if current process is a worker
 * @returns {boolean}
 */
export function isWorker() {
  return cluster.isWorker;
}

/**
 * Get worker ID (0 for primary)
 * @returns {number}
 */
export function getWorkerId() {
  return cluster.worker?.id || 0;
}

/**
 * Get number of active workers
 * @returns {number}
 */
export function getWorkerCount() {
  return Object.keys(cluster.workers || {}).length;
}

export default { clusterize, isPrimary, isWorker, getWorkerId, getWorkerCount };
