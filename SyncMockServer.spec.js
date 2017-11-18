/* global describe, test, expect */
import fetch from 'node-fetch'
import withMockServer from './index'

describe('SyncMockServer', () => {
  test('basic use case', (done) => {
    withMockServer({}, (mockServer) => {
      const resultFuture = fetch(mockServer.url('/example'))
      mockServer.respondTo('GET', '/example', (respond) => respond.withJson({hello: 'world'}))
      return resultFuture
        .then((r) => r.json())
        .then((r) => {
          expect(r).toEqual({hello: 'world'})
          mockServer.close()
          done()
        })
    })
  })
})
