import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

class MemoryQueue extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.queue = [];
    this.processing = false;
    this.concurrency = 1;
    this.active = 0;
  }

  add(data, options = {}) {
    const job = {
      id: `${this.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      data,
      options,
      timestamp: new Date(),
      status: 'queued',
      progress: 0,
    };
    this.queue.push(job);
    logger.debug(`Job queued`, { queue: this.name, jobId: job.id });
    this.processNext();
    return job;
  }

  process(handler) {
    this.handler = handler;
  }

  async processNext() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      job.status = 'running';
      this.active++;

      try {
        this.emit('active', job);
        const result = await this.handler(job);
        job.status = 'completed';
        this.emit('completed', job, result);
        logger.info(`Job completed`, { queue: this.name, jobId: job.id });
      } catch (err) {
        job.status = 'failed';
        job.error = err.message;
        this.emit('failed', job, err);
        logger.error(`Job failed`, { queue: this.name, jobId: job.id, error: err.message });
      } finally {
        this.active--;
      }
    }

    this.processing = false;
    this.emit('drain');
  }

  getJob(jobId) {
    return this.queue.find((j) => j.id === jobId);
  }

  getQueueSize() {
    return this.queue.length;
  }

  getActiveCount() {
    return this.active;
  }
}

const queues = {};

export function getQueue(name) {
  if (!queues[name]) {
    queues[name] = new MemoryQueue(name);
  }
  return queues[name];
}

export function createQueue(name) {
  return getQueue(name);
}

export { MemoryQueue };
