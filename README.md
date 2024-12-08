# Task

[![version](https://img.shields.io/github/v/release/molvqingtai/task)](https://www.npmjs.com/package/@resreq/task) [![workflow](https://github.com/molvqingtai/task/actions/workflows/ci.yml/badge.svg)](https://github.com/molvqingtai/task/actions) [![download](https://img.shields.io/npm/dt/@resreq/task)](https://www.npmjs.com/package/@resreq/task)

⏰ Short and sweet task.

## Install

```shell
npm install @resreq/task
```

## Usage

```typescript
import Task from '@resreq/task'

const log1 = (time: number) => console.log('log1:', time)
const log2 = (time: number) => console.log('log2:', time)
const log3 = (time: number) => console.log('log3:', time)

const task = new Task({
  interval: 1000
})

task.push('id-1', log1)
task.push('id-2', log2)
task.push('id-3', log3)

task.start()

setTimeout(() => {
  task.stop()
}, 3000)

// log1: 1733133501541
// log2: 1733133502541
// log3: 1733133503541
```

**Adapter**

`setTimeout` is used by default, and custom adapters are supported, such as `requestAnimationFrame`, `cancelIdleCallback`, etc...

```typescript
const task = new Task({
  adapter: {
    setTimer: globalThis.requestAnimationFrame.bind(globalThis),
    cancelTimer: globalThis.cancelAnimationFrame.bind(globalThis)
  }
})
```

## LICENSE

This project is licensed under the MIT License - see the [LICENSE](https://github.com/molvqingtai/task/blob/master/LICENSE) file for details.
