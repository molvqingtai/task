import Timer, { TimerAdapter } from '@resreq/timer'
import EventHub from '@resreq/event-hub'

export type { TimerAdapter }

export interface TaskOptions {
  interval?: number
  includeAsyncTime?: boolean
  adapter?: TimerAdapter
}

export type TaskRunnerRun = () => any | Promise<any>

export type TaskRunnerStatus = 'pending' | 'running' | 'success' | 'error'

export type TaskRunnerId = number | string | symbol

export type TaskRunner = {
  status: TaskRunnerStatus
  data?: any
  error?: Error
  id: TaskRunnerId
  index: number
  run: TaskRunnerRun
}

export type TaskStatus = 'running' | 'paused' | 'stopped'

export type TaskEvent = { status: TaskStatus; runners: TaskRunner[] }

export type TaskRunnerEvent = TaskRunner

export interface TaskListener {
  start: (event: TaskEvent) => void
  pause: (event: TaskEvent) => void
  stop: (event: TaskEvent) => void
  clear: (event: TaskEvent) => void
  reset: (event: TaskEvent) => void
  push: (event: TaskEvent) => void
  change: (event: TaskEvent) => void
  'runner:start': (event: TaskRunnerEvent) => void
  'runner:success': (event: TaskRunnerEvent) => void
  'runner:error': (event: TaskRunnerEvent) => void
  'runner:end': (event: TaskRunnerEvent) => void
}

export default class Task {
  private readonly interval: number
  private readonly includeAsyncTime: boolean
  private readonly adapter: TimerAdapter
  private readonly eventHub: EventHub
  private timer: Timer | null = null
  public readonly runners: Map<TaskRunnerId, TaskRunner> = new Map()
  public status: TaskStatus
  constructor(options?: TaskOptions) {
    this.status = 'stopped'
    this.interval = options?.interval ?? 0
    this.includeAsyncTime = options?.includeAsyncTime ?? false
    this.adapter = options?.adapter ?? {
      setTimer: globalThis.setTimeout.bind(globalThis),
      cancelTimer: globalThis.clearTimeout.bind(globalThis)
    }
    this.eventHub = new EventHub()
  }
  on<T extends keyof TaskListener>(event: T, listener: TaskListener[T]) {
    this.eventHub.on(event, listener)
  }

  off<T extends keyof TaskListener>(event?: T | T[], listener?: TaskListener[T]) {
    this.eventHub.off(event, listener)
  }
  query(): TaskRunner[]
  query(TaskRunnerId: TaskRunnerId): TaskRunner | null
  query(TaskRunnerId?: TaskRunnerId): TaskRunner[] | TaskRunner | null {
    if (TaskRunnerId !== undefined) {
      return this.runners.get(TaskRunnerId) || null
    } else {
      return [...this.runners.values()].map((task) => task)
    }
  }
  push(TaskRunnerId: TaskRunnerId, run: TaskRunnerRun, init?: Omit<TaskRunner, 'run'>) {
    if (this.runners.has(TaskRunnerId)) {
      throw new Error(`Task "${TaskRunnerId.toString()}" already exists`)
    }
    this.runners.set(TaskRunnerId, {
      ...{ status: 'pending', data: undefined, error: undefined, id: TaskRunnerId, index: this.runners.size, ...init },
      run
    })
    this.eventHub.emit('push', { status: this.status, runners: this.query() })
    this.status === 'running' && this.timer?.start()
    this.eventHub.emit('change', { status: this.status, runners: this.query() })
  }

  start() {
    if (this.status === 'running') return
    if (!this.timer) {
      this.timer = new Timer(
        async () => {
          const runner = [...this.runners.values()].find(({ status }) => status === 'pending')
          if (!runner) return
          try {
            this.runners.get(runner!.id)!.status = 'running'
            this.eventHub.emit('runner:start', runner)
            this.eventHub.emit('change', { status: this.status, runners: this.query() })
            const data = await runner.run()
            this.runners.get(runner!.id)!.status = 'success'
            this.runners.get(runner!.id)!.data = data
            this.eventHub.emit('runner:success', runner)
          } catch (error) {
            this.runners.get(runner.id)!.status = 'error'
            this.runners.get(runner.id)!.error = error as Error
            this.eventHub.emit('runner:error', runner)
          } finally {
            this.eventHub.emit('runner:end', runner)
            this.eventHub.emit('change', { status: this.status, runners: this.query() })
          }
        },
        {
          adapter: this.adapter,
          interval: this.interval,
          includeAsyncTime: this.includeAsyncTime,
          immediate: true
        }
      )
    }
    this.runners.size && this.timer.start()
    this.status = 'running'
    this.eventHub.emit('start', { status: this.status, runners: this.query() })
    this.eventHub.emit('change', { status: this.status, runners: this.query() })
  }
  pause() {
    if (this.status === 'paused') return
    this.timer?.pause()
    this.status = 'paused'
    this.eventHub.emit('pause', { status: this.status, runners: this.query() })
    this.eventHub.emit('change', { status: this.status, runners: this.query() })
  }
  stop() {
    if (this.status === 'stopped') return
    this.timer?.stop()
    this.status = 'stopped'
    this.eventHub.emit('stop', { status: this.status, runners: this.query() })
    this.eventHub.emit('change', { status: this.status, runners: this.query() })
  }
  clear() {
    if (!this.runners.size) return
    this.timer?.stop()
    this.status = 'stopped'
    this.runners.clear()
    this.eventHub.emit('clear', { status: this.status, runners: this.query() })
    this.eventHub.emit('change', { status: this.status, runners: this.query() })
  }
  reset() {
    if (!this.runners.size) return
    this.timer?.stop()
    this.status = 'stopped'
    this.runners.forEach((runner) => {
      runner.status = 'pending'
      runner.data = null
      runner.error = null
    })
    this.eventHub.emit('reset', { status: this.status, runners: this.query() })
    this.eventHub.emit('change', { status: this.status, runners: this.query() })
  }
}
