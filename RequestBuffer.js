import CircularBuffer from 'circular-buffer'

const NOOP = () => undefined

class RequestBuffer extends CircularBuffer {
  constructor (capacity, discardCallback = NOOP) {
    super(capacity)
    this.discardCallback = discardCallback
  }

  forEach (callback) {
    for (let i = 0; i < this.size(); i++) {
      callback(this.get(i), i)
    }
  }

  push (value) {
    if (this.size() === this.capacity()) {
      this.discardCallback(this.get(0))
    }
    super.push(value)
  }

  enq (value) {
    if (this.size() === this.capacity()) {
      this.discardCallback(this.get(this.size() - 1))
    }
    super.enq(value)
  }
}

export default RequestBuffer
