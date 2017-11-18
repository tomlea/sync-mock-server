/* global jest, describe, test, expect */
import RequestBuffer from './RequestBuffer'

describe('RequestBuffer', () => {
  test('push calls discardCallback if needed', () => {
    const discardCallback = jest.fn()
    const buff = new RequestBuffer(2, discardCallback)
    buff.push(1)
    buff.push(2)
    expect(discardCallback).not.toBeCalled()
    buff.push(3)
    expect(discardCallback).toBeCalledWith(1)
    expect(buff.toarray()).toEqual([2, 3])
  })

  test('enq calls discardCallback if needed', () => {
    const discardCallback = jest.fn()
    const buff = new RequestBuffer(2, discardCallback)
    buff.enq(1)
    buff.enq(2)
    expect(discardCallback).not.toBeCalled()
    buff.enq(3)
    expect(discardCallback).toBeCalledWith(1)
    expect(buff.toarray()).toEqual([3, 2])
  })

  test('forEach', () => {
    const buff = new RequestBuffer(2)
    buff.enq(1)
    buff.enq(2)
    const output = []
    let counter = 0
    buff.forEach((v, index) => {
      expect(counter).toEqual(index)
      counter++
      output.push(v)
    })

    expect(output).toEqual(buff.toarray())
  })
})
